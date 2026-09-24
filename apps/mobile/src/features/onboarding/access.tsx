import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@powersync/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/db/provider";
import type { List } from "@/db/schema";
import { powersync } from "@/db/system";
import { supabase } from "@/lib/supabase";

type Household = { id: string; name: string };
type Access = {
  ready: boolean;
  complete: boolean;
  listId: string | null;
  households: Household[];
  switchHousehold: (listId: string) => void;
  error: string | null;
  retry: () => void;
};
const Context = createContext<Access>({
  ready: false,
  complete: false,
  listId: null,
  households: [],
  switchHousehold: () => {},
  error: null,
  retry: () => {},
});
export function useHouseholdAccess() {
  return useContext(Context);
}

/** The household the app is showing: one list, chosen on this device. */
export function useActiveList(): List | null {
  const { listId } = useHouseholdAccess();
  const { data } = useQuery<List>("SELECT * FROM lists WHERE id = ?", [listId]);
  return data.find((l) => l.id === listId) ?? null;
}

// A device preference, not account data: the earliest household is the
// fallback whenever the stored one is missing or no longer yours.
const ACTIVE_KEY = "estra.active-list.v1";

export function HouseholdAccessProvider({ children }: { children: ReactNode }) {
  const { session, ready, epoch, syncReady, syncError, retrySync } = useAuth();
  const userId = session?.user.id ?? null;
  const { data } = useQuery<{
    id: string;
    name: string;
    user_id: string;
    profile_id: string | null;
  }>(
    "SELECT l.id, l.name, m.user_id, p.id AS profile_id FROM lists l JOIN list_members m ON m.list_id = l.id LEFT JOIN household_profiles p ON p.id = l.id WHERE m.user_id = ? ORDER BY l.created_at, l.id",
    [userId],
  );
  const [preferred, setPreferred] = useState<string | null | undefined>();
  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_KEY)
      .then(setPreferred)
      .catch(() => setPreferred(null));
  }, []);
  const switchHousehold = useCallback((listId: string) => {
    setPreferred(listId);
    AsyncStorage.setItem(ACTIVE_KEY, listId).catch(() => {});
  }, []);
  // Watched queries may still carry their previous result while rebinding.
  const mine = useMemo(
    () => data.filter((row) => row.user_id === userId),
    [data, userId],
  );
  // A list without a Profile can't be shown, so it can't be switched to.
  const households = useMemo(
    () => mine.filter((row) => row.profile_id),
    [mine],
  );
  const local =
    mine.find((row) => row.id === preferred && row.profile_id) ?? mine[0];
  const [lookup, setLookup] = useState<{
    epoch: number;
    listId: string | null;
    error: string | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ready || !syncReady || !userId || local?.profile_id) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    async function resolve() {
      // A cache miss is not evidence of absence. Confirm through RLS, then
      // let PowerSync deliver any existing household before allowing setup.
      const members = await supabase
        .from("list_members")
        .select("list_id, lists!inner(id, created_at)")
        .eq("user_id", userId!)
        .abortSignal(controller.signal);
      if (members.error) throw members.error;
      const lists = (members.data ?? []).map(
        (m) => m.lists as unknown as { id: string; created_at: string },
      );
      lists.sort(
        (a, b) =>
          a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
      );
      const listId = lists[0]?.id ?? null;
      if (listId) {
        const profile = await supabase
          .from("household_profiles")
          .select("id")
          .eq("id", listId)
          .abortSignal(controller.signal)
          .maybeSingle();
        if (profile.error) throw profile.error;
        await powersync.waitForFirstSync({
          signal: controller.signal,
          priority: 2,
        });
        if (controller.signal.aborted)
          throw new Error("Household sync took too long. Try again.");
        // A fresh download must include the list; an old hasSynced checkpoint
        // alone is insufficient after signing in or switching devices.
        const cached = await powersync.getOptional(
          "SELECT id FROM lists WHERE id = ?",
          [listId],
        );
        const cachedProfile = profile.data
          ? await powersync.getOptional(
              "SELECT id FROM household_profiles WHERE id = ?",
              [listId],
            )
          : true;
        if (!cached || !cachedProfile)
          throw new Error(
            "Your household is still downloading. Try again shortly.",
          );
      }
      if (!controller.signal.aborted) setLookup({ epoch, listId, error: null });
    }
    resolve()
      .catch((error: unknown) => {
        if (!cancelled)
          setLookup({
            epoch,
            listId: null,
            error:
              error instanceof Error
                ? error.message
                : "Could not load your household. Try again.",
          });
      })
      .finally(() => clearTimeout(timeout));
    let cancelled = false;
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [ready, syncReady, epoch, userId, local?.profile_id, attempt]);
  const complete =
    !!userId && syncReady && preferred !== undefined && !!local?.profile_id;
  const checked = lookup?.epoch === epoch ? lookup : null;
  return (
    <Context.Provider
      value={{
        ready: ready && (!userId || complete || (!!checked && syncReady)),
        complete,
        listId: complete ? local.id : (checked?.listId ?? null),
        households,
        switchHousehold,
        error: syncError ?? checked?.error ?? null,
        retry: () => {
          setLookup(null);
          setAttempt((n) => n + 1);
          retrySync();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

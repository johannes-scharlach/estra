import { PowerSyncContext } from "@powersync/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "../lib/supabase";
import { connectPowerSync, disconnectPowerSync, powersync } from "./system";

const CACHE_USER_KEY = "estra.powersync-user";

type AuthState = {
  session: Session | null;
  /** False until we know whether a stored session exists. */
  ready: boolean;
  epoch: number;
  syncReady: boolean;
  syncError: string | null;
  retrySync: () => void;
};

const AuthContext = createContext<AuthState>({
  session: null,
  ready: false,
  epoch: 0,
  syncReady: false,
  syncError: null,
  retrySync: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function SystemProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<{
    session: Session | null;
    epoch: number;
  }>({ session: null, epoch: 0 });
  const { session, epoch } = identity;
  const [ready, setReady] = useState(false);
  const [syncedEpoch, setSyncedEpoch] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const connection = useRef(Promise.resolve());
  const connectedUser = useRef<string | null | undefined>(undefined);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    let active = true;
    let receivedAuthChange = false;
    function setSession(next: Session | null) {
      setIdentity((previous) => ({
        session: next,
        epoch:
          previous.epoch +
          (previous.session?.user.id !== next?.user.id ? 1 : 0),
      }));
    }
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        if (!receivedAuthChange) setSession(data.session);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (active)
          setSyncError(
            error instanceof Error
              ? error.message
              : "Could not read your session. Try again.",
          );
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, next) => {
        if (event !== "INITIAL_SESSION") receivedAuthChange = true;
        setSession(next);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [attempt]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    // Clear/connect must not overlap when verification or account switching
    // happens while an earlier disconnect is still running.
    connection.current = connection.current
      .catch(() => {})
      .then(async () => {
        if (connectedUser.current === undefined) {
          connectedUser.current =
            (await AsyncStorage.getItem(CACHE_USER_KEY)) ?? undefined;
        }
        if (connectedUser.current !== userId) {
          if (connectedUser.current !== undefined || userId === null)
            await disconnectPowerSync();
          connectedUser.current = userId;
        }
        // Keep cache ownership across a process closing during account change.
        if (userId) await AsyncStorage.setItem(CACHE_USER_KEY, userId);
        else await AsyncStorage.removeItem(CACHE_USER_KEY);
        if (userId) await connectPowerSync();
        if (active) {
          setSyncedEpoch(epoch);
          setSyncError(null);
        }
      })
      .catch((error: unknown) => {
        if (active)
          setSyncError(
            error instanceof Error
              ? error.message
              : "Could not open your household.",
          );
      });
    return () => {
      active = false;
    };
  }, [ready, userId, epoch, attempt]);

  const auth = useMemo(
    () => ({
      session,
      ready,
      epoch,
      syncReady: ready && syncedEpoch === epoch,
      syncError,
      retrySync: () => setAttempt((n) => n + 1),
    }),
    [session, ready, syncedEpoch, epoch, syncError],
  );

  return (
    <AuthContext.Provider value={auth}>
      <PowerSyncContext.Provider value={powersync}>
        {children}
      </PowerSyncContext.Provider>
    </AuthContext.Provider>
  );
}

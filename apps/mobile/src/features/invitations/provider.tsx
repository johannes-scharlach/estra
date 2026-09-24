import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { invitationCode } from "./links";

const KEY = "estra.pending-invitation.v1";
type InvitationState = {
  code: string | null;
  ready: boolean;
  error: string | null;
  clear: () => Promise<void>;
  retry: () => void;
};
const Context = createContext<InvitationState | null>(null);

export function useInvitation() {
  const value = useContext(Context);
  if (!value) throw new Error("InvitationProvider is missing");
  return value;
}

/** Separate from the auth cache: signing in must not discard the invitation. */
export function InvitationProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string | null>(null);
  const current = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const writes = useRef(Promise.resolve());
  const save = useCallback((next: string | null) => {
    const write = writes.current.catch(() => {}).then(() =>
      next ? AsyncStorage.setItem(KEY, next) : AsyncStorage.removeItem(KEY)
    );
    writes.current = write;
    return write;
  }, []);
  useEffect(() => {
    let active = true;
    let incoming: string | null = null;
    const accept = (next: string) => {
      current.current = next;
      setCode(next);
      void save(next).then(() => setError(null)).catch(() =>
        setError(
          "Could not save this invitation. Keep the original link to try again.",
        )
      );
    };
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const next = invitationCode(url);
      if (next) {
        incoming = next;
        accept(next);
      }
    });
    Promise.all([Linking.getInitialURL(), AsyncStorage.getItem(KEY)])
      .then(([url, saved]) => {
        if (!active) return;
        const next = incoming ?? invitationCode(url) ?? saved;
        if (next) accept(next);
        setReady(true);
      })
      .catch(() => {
        if (active) setError("Could not restore your invitation. Try again.");
      });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [attempt, save]);
  const clear = useCallback(async () => {
    // A newly opened invitation wins over cleanup from the previous screen.
    if (current.current !== code) return;
    await save(null);
    if (current.current !== code) return;
    current.current = null;
    setCode(null);
    setError(null);
  }, [code, save]);
  return (
    <Context.Provider
      value={{
        code,
        ready,
        error,
        clear,
        retry: () => setAttempt((n) => n + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}

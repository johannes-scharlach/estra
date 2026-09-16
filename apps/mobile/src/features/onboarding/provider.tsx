import * as Crypto from "expo-crypto";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createDraft, type OnboardingDraft } from "./draft";
import { loadDraft, saveDraft } from "./draft-storage";

type DraftState = {
  draft: OnboardingDraft | null;
  ready: boolean;
  error: string | null;
  update: (
    change: (draft: OnboardingDraft) => OnboardingDraft,
  ) => Promise<OnboardingDraft>;
  commit: (
    change: (draft: OnboardingDraft) => OnboardingDraft,
  ) => Promise<void>;
  clear: () => Promise<void>;
  retry: () => void;
};
const Context = createContext<DraftState | null>(null);
export function useOnboarding() {
  const value = useContext(Context);
  if (!value) throw new Error("OnboardingProvider is missing");
  return value;
}
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const current = useRef<OnboardingDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadDraft()
      .then((saved) => {
        if (!active) return;
        current.current = saved;
        setDraft(saved);
        setReady(true);
        setError(null);
      })
      .catch(() => {
        if (active) setError("Could not read your saved setup. Try again.");
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const update = useCallback(
    async (change: (draft: OnboardingDraft) => OnboardingDraft) => {
      const next = change(
        current.current ??
          createDraft(Crypto.randomUUID(), Crypto.randomUUID()),
      );
      current.current = next;
      setDraft(next);
      try {
        await saveDraft(next);
        setError(null);
        return next;
      } catch {
        setError(
          "Could not save progress on this device. Try again before closing the app.",
        );
        throw new Error("Could not save setup progress.");
      }
    },
    [],
  );
  const clear = useCallback(async () => {
    await saveDraft(null);
    current.current = null;
    setDraft(null);
    setError(null);
  }, []);
  const commit = useCallback(
    async (change: (draft: OnboardingDraft) => OnboardingDraft) => {
      if (!current.current) throw new Error("Your setup is not ready.");
      const next = change(current.current);
      // Nested editors publish only after a successful save. A failed save
      // followed by Cancel leaves the parent answers untouched.
      await saveDraft(next);
      current.current = next;
      setDraft(next);
      setError(null);
    },
    [],
  );
  return (
    <Context.Provider
      value={{
        draft,
        ready,
        error,
        update,
        commit,
        clear,
        retry: () => setAttempt((n) => n + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}

import { useSyncExternalStore } from "react";

/**
 * Which chat Home shows. Null means "the most recent one"; a fresh uuid
 * means a new chat that does not exist until its first message is sent.
 * Module state rather than a route param so the history sheet can set it
 * and simply dismiss.
 */
let current: string | null = null;
const listeners = new Set<() => void>();

export function setCurrentChat(id: string | null) {
  current = id;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useCurrentChat(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}

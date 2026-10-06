import type { NotificationState } from "./notifications";

/**
 * What the foreground refresh should do to make the server mirror the OS.
 * The OS owns the off switch: only a granted permission keeps a device
 * registered, because a revoked device silently swallows every push.
 */
export type PushRegistrationAction = "register" | "unregister";

export function pushRegistrationAction(
  state: NotificationState,
): PushRegistrationAction {
  return state === "enabled" ? "register" : "unregister";
}

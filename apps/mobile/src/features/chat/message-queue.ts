import type { Photo } from "./photo";

/**
 * A message queued for the chat screen, handed over beside the push: the
 * producer queues it, then navigates, and the chat screen sends it once
 * when focused — on mount for a fresh chat, or on return from the plan
 * sheet mid-conversation (ADR 9 — a fresh chat's id is chosen
 * client-side). One slot, in memory only.
 */
export type QueuedMessage = { messageId: string; text: string; photo: Photo | null };

let queued: QueuedMessage | null = null;

export function queueMessage(message: QueuedMessage) {
  queued = message;
}

export function takeQueuedMessage(): QueuedMessage | null {
  const found = queued;
  queued = null;
  return found;
}

export function peekQueuedMessage(): QueuedMessage | null {
  return queued;
}

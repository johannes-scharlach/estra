import type { ImageAttachment } from "./image-attachment";

/**
 * A message queued for the chat screen, handed over beside the push: the
 * producer queues it, then navigates, and the chat screen sends it once
 * when focused — on mount for a fresh chat, or on return from the plan
 * sheet mid-conversation (ADR 9 — a fresh chat's id is chosen
 * client-side). One slot, in memory only.
 */
export type QueuedMessage = {
  chatId?: string;
  listId?: string;
  recipeContext?: {
    variantId: string;
    recipeId: string;
    plannedMealId?: string;
    previewSwaps?: Record<number, number>;
  };
  messageId: string;
  text: string;
  attachments: ImageAttachment[];
};

let queued: QueuedMessage | null = null;

export function queueMessage(message: QueuedMessage) {
  queued = message;
}

export function takeQueuedMessage(chatId?: string): QueuedMessage | null {
  if (queued?.chatId && queued.chatId !== chatId) return null;
  const found = queued;
  queued = null;
  return found;
}

export function peekQueuedMessage(chatId?: string): QueuedMessage | null {
  if (queued?.chatId && queued.chatId !== chatId) return null;
  return queued;
}

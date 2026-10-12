/**
 * The chat being read. Its own reply push stays quiet; every other push,
 * including replies for other chats, shows as usual (ADR 26).
 */
let onScreen: string | null = null;

export function setChatOnScreen(chatId: string | null) {
  onScreen = chatId;
}

export function hidesPush(data: Record<string, unknown>): boolean {
  return data.kind === "chat_reply" && data.chatId === onScreen;
}

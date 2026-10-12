import { describe, expect, it } from "vitest";

import { hidesPush, setChatOnScreen } from "./chat-on-screen";

describe("chat on screen", () => {
  it("hides only the reply push for the chat being read", () => {
    setChatOnScreen("chat-1");
    expect(hidesPush({ kind: "chat_reply", chatId: "chat-1" })).toBe(true);
    expect(hidesPush({ kind: "chat_reply", chatId: "chat-2" })).toBe(false);
    expect(hidesPush({ kind: "items_added" })).toBe(false);

    setChatOnScreen(null);
    expect(hidesPush({ kind: "chat_reply", chatId: "chat-1" })).toBe(false);
  });
});

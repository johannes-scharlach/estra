import { expect, it } from "vitest";

import {
  peekQueuedMessage,
  queueMessage,
  takeQueuedMessage,
} from "./message-queue";

it("a recipe's first message can only be consumed by its new chat", () => {
  const message = {
    chatId: "new",
    messageId: "first",
    text: "Use tuna",
    attachments: [],
  };
  queueMessage(message);
  expect(takeQueuedMessage("previous")).toBeNull();
  expect(peekQueuedMessage("new")).toEqual(message);
  expect(takeQueuedMessage("new")).toEqual(message);
  expect(takeQueuedMessage("new")).toBeNull();
});

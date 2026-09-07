import { describe, expect, it } from "vitest";

import { attachUploadedImage, type ChatTurn } from "./chat-turn";
import type { FilePart } from "./image-attachment";

describe("attachUploadedImage", () => {
  it("keeps image order and consumes only the uploaded attachment", () => {
    const turn: ChatTurn = {
      message: {
        id: "message-id",
        role: "user",
        parts: [{ type: "text", text: "Help me plan dinner." }],
      },
      attachments: [
        { uri: "file:///fridge.jpg", mediaType: "image/jpeg" },
        { uri: "file:///cupboard.jpg", mediaType: "image/jpeg" },
      ],
    };
    const file: FilePart = {
      type: "file",
      mediaType: "image/jpeg",
      url: "https://example.test/fridge.jpg",
    };

    expect(attachUploadedImage(turn, file)).toEqual({
      message: {
        id: "message-id",
        role: "user",
        parts: [file, { type: "text", text: "Help me plan dinner." }],
      },
      attachments: [{ uri: "file:///cupboard.jpg", mediaType: "image/jpeg" }],
    });
  });
});

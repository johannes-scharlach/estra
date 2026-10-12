import { assertEquals } from "jsr:@std/assert@^1";
import { chatReplyText } from "./chat-reply-text.ts";

const turn = (status: string, error?: string) => ({
  type: "data-turn",
  data: { status, ...(error ? { error } : {}) },
});

Deno.test("a finished reply reads as plain text under the chat's title", () => {
  assertEquals(
    chatReplyText({
      chat_title: "Green soup",
      reply_parts: [
        { type: "text", text: "I checked your plan." },
        {
          type: "text",
          text: '**Thursday** is free.\n\n<sketch title="Green soup">\n## Eating it\nBright and [silky](magpie://r/1).\n</sketch>',
        },
        turn("completed"),
      ],
    }),
    {
      title: "Green soup",
      body: "I checked your plan. Thursday is free. Eating it Bright and silky.",
    },
  );
});

Deno.test("a long reply is cut at a word", () => {
  const body = chatReplyText({
    chat_title: "Soup",
    reply_parts: [
      { type: "text", text: "word ".repeat(100) },
      turn("completed"),
    ],
  }).body;
  assertEquals(body.length <= 180, true);
  assertEquals(body.endsWith("word…"), true);
});

Deno.test("a failed reply says what the chat says", () => {
  assertEquals(
    chatReplyText({
      chat_title: null,
      reply_parts: [
        { type: "text", text: "Let me" },
        turn(
          "failed",
          "The model is busy right now. You can continue in a moment.",
        ),
      ],
    }),
    {
      title: "Your chat",
      body: "The model is busy right now. You can continue in a moment.",
    },
  );
});

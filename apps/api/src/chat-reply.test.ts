import assert from "node:assert/strict";
import { test } from "node:test";
import { APICallError, stepCountIs, streamText, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { createChatReply, type AssistantUIMessage } from "./chat-reply.js";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test(
  "a disconnected phone still gets a complete, saved chat turn, and a push",
  { timeout: 5000 },
  async () => {
    const resume = deferred<void>();
    const saved = deferred<AssistantUIMessage>();
    const notified = deferred<AssistantUIMessage>();
    const request = new AbortController();
    let latest: AssistantUIMessage | undefined;
    const result = streamText({
      prompt: "Help with dinner",
      model: new MockLanguageModelV4({
        doStream: {
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] });
              controller.enqueue({ type: "text-start", id: "text" });
              controller.enqueue({
                type: "text-delta",
                id: "text",
                delta: "First half",
              });
              await resume.promise;
              controller.enqueue({
                type: "text-delta",
                id: "text",
                delta: ", complete reply.",
              });
              controller.enqueue({ type: "text-end", id: "text" });
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "stop", raw: "STOP" },
                usage: {
                  inputTokens: {
                    total: 1,
                    noCache: 1,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                  outputTokens: { total: 1, text: 1, reasoning: 0 },
                },
              });
              controller.close();
            },
          }),
        },
      }),
    });
    const response = createChatReply({
      id: "reply",
      userMessageId: "question",
      request: request.signal,
      run: async () => result,
      suggestions: async () => [],
      save: async (message) => {
        latest = structuredClone(message);
        if (
          message.parts.find((part) => part.type === "data-turn")?.data
            .status !== "running"
        )
          saved.resolve(latest);
      },
      notify: async () => notified.resolve(latest!),
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let received = "";
    while (!received.includes("First half")) {
      const chunk = await reader.read();
      assert.equal(chunk.done, false);
      received += decoder.decode(chunk.value, { stream: true });
    }

    request.abort("Client connection prematurely closed.");
    const disconnected = reader.cancel("Phone locked");
    resume.resolve();
    await disconnected;

    const reply = await saved.promise;
    assert.equal(reply.id, "reply");
    assert.deepEqual(
      reply.parts
        .filter((part) => part.type === "text")
        .map(({ type, text, state }) => ({ type, text, state })),
      [{ type: "text", text: "First half, complete reply.", state: "done" }],
    );
    assert.deepEqual(
      reply.parts.find((part) => part.type === "data-turn")?.data,
      {
        userMessageId: "question",
        status: "completed",
      },
    );
    const lastSaved = await notified.promise;
    assert.equal(
      lastSaved.parts.find((part) => part.type === "data-turn")?.data.status,
      "completed",
    );
  },
);

test("a phone that stayed until the end gets no push, even if it hangs up right after", async () => {
  const request = new AbortController();
  let pushes = 0;
  const response = createChatReply({
    id: "reply",
    userMessageId: "question",
    request: request.signal,
    run: async () =>
      streamText({
        prompt: "Help with dinner",
        model: new MockLanguageModelV4({
          doStream: {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: "stream-start", warnings: [] });
                controller.enqueue({ type: "text-start", id: "text" });
                controller.enqueue({
                  type: "text-delta",
                  id: "text",
                  delta: "Soup.",
                });
                controller.enqueue({ type: "text-end", id: "text" });
                controller.enqueue({
                  type: "finish",
                  finishReason: { unified: "stop", raw: "STOP" },
                  usage: {
                    inputTokens: {
                      total: 1,
                      noCache: 1,
                      cacheRead: 0,
                      cacheWrite: 0,
                    },
                    outputTokens: { total: 1, text: 1, reasoning: 0 },
                  },
                });
                controller.close();
              },
            }),
          },
        }),
      }),
    suggestions: async () => [],
    save: async () => {},
    notify: async () => {
      pushes += 1;
    },
  });
  const delivered = await response.text();
  assert.ok(delivered.includes('"status":"completed"'));
  // The app aborts its request once PowerSync shows the end.
  request.abort();
  await new Promise((done) => setTimeout(done, 10));
  assert.equal(pushes, 0);
});

test("a real model failure marks the partial reply failed and keeps completed actions", async () => {
  let reply: AssistantUIMessage | undefined;
  const result = streamText({
    prompt: "Save dinner",
    stopWhen: stepCountIs(3),
    onError: () => {},
    tools: {
      addToCookbook: tool({
        inputSchema: z.object({}),
        execute: async () => ({ variantId: "saved", name: "Pomodoro" }),
      }),
    },
    model: new MockLanguageModelV4({
      doStream: [
        {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] });
              controller.enqueue({
                type: "tool-call",
                toolCallId: "save",
                toolName: "addToCookbook",
                input: "{}",
              });
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "tool-calls", raw: "STOP" },
                usage: {
                  inputTokens: {
                    total: 1,
                    noCache: 1,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                  outputTokens: { total: 1, text: 1, reasoning: 0 },
                },
              });
              controller.close();
            },
          }),
        },
        {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] });
              controller.enqueue({ type: "text-start", id: "text" });
              controller.enqueue({
                type: "text-delta",
                id: "text",
                delta: "Saved your recipe, and",
              });
              controller.enqueue({
                type: "error",
                error: new Error("Internal provider credential details"),
              });
              controller.close();
            },
          }),
        },
      ],
    }),
  });
  const response = createChatReply({
    id: "reply",
    userMessageId: "question",
    request: new AbortController().signal,
    run: async () => result,
    suggestions: async () => ["Plan it for tonight"],
    save: async (message) => {
      reply = structuredClone(message);
    },
    notify: async () => {},
  });

  const delivered = await response.text();
  assert.ok(reply);
  assert.deepEqual(
    reply.parts.find((part) => part.type === "data-turn")?.data,
    {
      userMessageId: "question",
      status: "failed",
      error:
        "The reply couldn't be completed. Any changes already made are kept.",
    },
  );
  const savedAction = reply.parts.find(
    (part) => part.type === "tool-addToCookbook",
  );
  assert.ok(savedAction && "state" in savedAction);
  assert.equal(savedAction.state, "output-available");
  assert.deepEqual(savedAction.output, {
    variantId: "saved",
    name: "Pomodoro",
  });
  assert.equal(
    reply.parts.some((part) => part.type === "data-suggestions"),
    false,
  );
  assert.equal(
    delivered.includes("Internal provider credential details"),
    false,
  );
});

test(
  "completed actions are saved while the reply is running, and a recovered tool error does not fail the turn",
  { timeout: 5000 },
  async () => {
    const resume = deferred<void>();
    const checkpoint = deferred<AssistantUIMessage>();
    let reply: AssistantUIMessage | undefined;
    const result = streamText({
      prompt: "Save dinner",
      stopWhen: stepCountIs(4),
      tools: {
        addToCookbook: tool({
          inputSchema: z.object({ name: z.string() }),
          execute: async ({ name }) => ({ variantId: "saved", name }),
        }),
      },
      model: new MockLanguageModelV4({
        doStream: [
          ...["{}", '{"name":"Pomodoro"}'].map((input, index) => ({
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: "stream-start", warnings: [] });
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: `save-${index}`,
                  toolName: "addToCookbook",
                  input,
                });
                controller.enqueue({
                  type: "finish",
                  finishReason: { unified: "tool-calls", raw: "STOP" },
                  usage: {
                    inputTokens: {
                      total: 1,
                      noCache: 1,
                      cacheRead: 0,
                      cacheWrite: 0,
                    },
                    outputTokens: { total: 1, text: 1, reasoning: 0 },
                  },
                });
                controller.close();
              },
            }),
          })),
          {
            stream: new ReadableStream({
              async start(controller) {
                await resume.promise;
                controller.enqueue({ type: "stream-start", warnings: [] });
                controller.enqueue({ type: "text-start", id: "text" });
                controller.enqueue({
                  type: "text-delta",
                  id: "text",
                  delta: "Saved your recipe.",
                });
                controller.enqueue({ type: "text-end", id: "text" });
                controller.enqueue({
                  type: "finish",
                  finishReason: { unified: "stop", raw: "STOP" },
                  usage: {
                    inputTokens: {
                      total: 1,
                      noCache: 1,
                      cacheRead: 0,
                      cacheWrite: 0,
                    },
                    outputTokens: { total: 1, text: 1, reasoning: 0 },
                  },
                });
                controller.close();
              },
            }),
          },
        ],
      }),
    });
    const response = createChatReply({
      id: "reply",
      userMessageId: "question",
      request: new AbortController().signal,
      run: async () => result,
      suggestions: async () => [],
      save: async (message) => {
        reply = structuredClone(message);
        if (
          message.parts.some(
            (part) =>
              part.type === "tool-addToCookbook" &&
              "state" in part &&
              part.state === "output-available",
          )
        )
          checkpoint.resolve(reply);
      },
      notify: async () => {},
    });

    const running = await checkpoint.promise;
    assert.equal(
      running.parts.find((part) => part.type === "data-turn")?.data.status,
      "running",
    );
    resume.resolve();
    await response.text();
    assert.equal(
      reply?.parts.find((part) => part.type === "data-turn")?.data.status,
      "completed",
    );
  },
);

test("a failure preparing an accepted turn is saved as failed, not left running", async () => {
  let reply: AssistantUIMessage | undefined;
  const response = createChatReply({
    id: "reply",
    userMessageId: "question",
    request: new AbortController().signal,
    run: async () => {
      throw new APICallError({
        message: "Provider unavailable",
        url: "https://provider.test",
        requestBodyValues: {},
        statusCode: 503,
      });
    },
    suggestions: async () => [],
    save: async (message) => {
      reply = message;
    },
    notify: async () => {},
  });
  await response.text();
  assert.equal(
    reply?.parts.find((part) => part.type === "data-turn")?.data.status,
    "failed",
  );
  assert.equal(
    reply?.parts.find((part) => part.type === "data-turn")?.data.error,
    "The model is busy right now. You can continue in a moment.",
  );
});

import {
  APICallError,
  consumeStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  RetryError,
  toUIMessageStream,
  type TextStreamPart,
  type ToolSet,
  type UIMessage,
} from "ai";

import { chatToolErrorText } from "./chat-tool-errors.js";

export type ChatTurnState = {
  userMessageId: string;
  status: "running" | "completed" | "failed";
  error?: string;
};

export type AssistantUIMessage = UIMessage<
  never,
  { suggestions: string[]; turn: ChatTurnState }
>;

function errorTextFor(error: unknown): string {
  if (RetryError.isInstance(error) || APICallError.isInstance(error))
    return "The model is busy right now. You can continue in a moment.";
  return "The reply couldn't be completed. Any changes already made are kept.";
}

export function createChatReply<TOOLS extends ToolSet>(opts: {
  id: string;
  userMessageId: string;
  run: () => Promise<{
    stream: ReadableStream<TextStreamPart<TOOLS>>;
    text: PromiseLike<string>;
  }>;
  suggestions: (text: string) => Promise<string[]>;
  save: (message: AssistantUIMessage) => Promise<void>;
}): Response {
  const stream = createUIMessageStream<AssistantUIMessage>({
    generateId: () => opts.id,
    onError: (error) => {
      console.error("chat reply stream failed", error);
      return errorTextFor(error);
    },
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId: opts.id });
      writer.write({
        type: "data-turn",
        id: "turn",
        data: { userMessageId: opts.userMessageId, status: "running" },
      });
      let error: string | undefined;
      let finished = false;
      let text = "";
      try {
        const result = await opts.run();
        const observed = result.stream.pipeThrough(
          new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
            transform(part, controller) {
              if (part.type === "error") {
                console.error("chat generation failed", part.error);
                error = errorTextFor(part.error);
                return;
              }
              if (part.type === "abort") {
                error = errorTextFor(undefined);
                return;
              }
              if (part.type === "finish") {
                finished = true;
                if (part.finishReason !== "stop")
                  error ??= errorTextFor(undefined);
              }
              controller.enqueue(part);
            },
          }),
        );
        const ui = toUIMessageStream<TOOLS, AssistantUIMessage>({
          stream: observed,
          sendStart: false,
          sendFinish: false,
          onError: chatToolErrorText,
        });
        for await (const chunk of ui) writer.write(chunk);
        if (finished && !error) text = await result.text;
      } catch (cause) {
        console.error("chat generation failed", cause);
        error = errorTextFor(cause);
      }
      if (!finished) error ??= errorTextFor(undefined);

      if (!error) {
        try {
          const suggestions = await opts.suggestions(text);
          if (suggestions.length)
            writer.write({ type: "data-suggestions", data: suggestions });
        } catch (cause) {
          console.error("suggestions failed", cause);
        }
      }
      writer.write({
        type: "data-turn",
        id: "turn",
        data: {
          userMessageId: opts.userMessageId,
          status: error ? "failed" : "completed",
          ...(error ? { error } : {}),
        },
      });
      writer.write({ type: "finish" });
    },
    onStepEnd: ({ responseMessage }) => opts.save(responseMessage),
    onEnd: ({ responseMessage }) => opts.save(responseMessage),
  });
  // Drain the stream that assembles and saves the reply, not just the model.
  // A canceled HTTP body must not cancel persistence or save a partial reply.
  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: ({ stream }) =>
      consumeStream({
        stream,
        onError: (error) =>
          console.error("chat reply persistence failed", error),
      }),
  });
}

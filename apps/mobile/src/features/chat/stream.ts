import { DefaultChatTransport, readUIMessageStream, type UIMessage } from "ai";
import { fetch as expoFetch } from "expo/fetch";

import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { dateKey } from "@/features/meals/slots";
import type { QueuedMessage } from "./message-queue";

/** Mirrors the server-written data parts; no client writes turn outcomes. */
export type ChatTurnState = {
  userMessageId: string;
  status: "running" | "completed" | "failed";
  error?: string;
};
export type AssistantUIMessage = UIMessage<
  never,
  { suggestions: string[]; turn: ChatTurnState }
>;
export type Parts = AssistantUIMessage["parts"];

/** A rejection before acceptance is different from an uncertain connection. */
export class ChatRequestRejected extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
  }
}
class MessageAlreadyReceived extends Error {}

async function authorization() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ChatRequestRejected("Sign in to send a message.");
  return { authorization: `Bearer ${token}` };
}

/**
 * Sends one user message and yields the assistant reply as it grows
 * (each value is the whole message so far). ADR 9: the server persists both
 * messages; PowerSync brings them back, so the caller only needs to keep
 * the live preview on screen until the completed or failed row has synced.
 * Running rows are checkpoints, not a replacement for fresher streamed text.
 *
 * expo/fetch, not global fetch: React Native's fetch has no streaming body.
 */
export async function* streamReply(opts: {
  chatId: string;
  listId: string;
  message: AssistantUIMessage;
  signal?: AbortSignal;
  recipeContext?: QueuedMessage["recipeContext"];
  mealContext?: QueuedMessage["mealContext"];
}): AsyncGenerator<AssistantUIMessage> {
  const headers = await authorization();
  const chatFetch: typeof globalThis.fetch = async (...args) => {
    const response = await (expoFetch as unknown as typeof globalThis.fetch)(...args);
    if (response.status === 202) throw new MessageAlreadyReceived();
    if (response.status >= 400 && response.status < 500 && response.status !== 408) {
      const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
      throw new ChatRequestRejected(
        body?.error?.message ?? "Your message couldn't be sent.",
        response.status === 429 || body?.error?.code === "CHAT_BUSY",
      );
    }
    return response;
  };

  // The server reads the household from Postgres on every turn; the
  // request carries only the message.
  const transport = new DefaultChatTransport<AssistantUIMessage>({
    api: `${env.apiUrl}/v1/chats/${opts.chatId}/messages`,
    fetch: chatFetch,
    headers,
    // Only the newest message travels; history lives on the server. Local
    // time lets the assistant reason about season and region.
    prepareSendMessagesRequest: ({ messages }) => ({
      body: {
        listId: opts.listId,
        message: messages[messages.length - 1],
        localTime: `${new Date().toString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
        localDate: dateKey(new Date()),
        recipeContext: opts.recipeContext,
        mealContext: opts.mealContext,
      },
    }),
  });

  try {
    const stream = await transport.sendMessages({
      trigger: "submit-message",
      chatId: opts.chatId,
      messageId: undefined,
      messages: [opts.message],
      abortSignal: opts.signal,
    });
    // Old servers can still send terminal error parts. Treat them as an
    // uncertain delivery until the saved turn has been checked.
    for await (const message of readUIMessageStream<AssistantUIMessage>({
      stream,
      terminateOnError: true,
    })) {
      yield message;
    }
  } catch (error) {
    if (error instanceof MessageAlreadyReceived) return;
    throw error;
  }
}

/** Read-only reconciliation: this endpoint never runs the agent. */
export async function readChatTurn(opts: {
  chatId: string;
  listId: string;
  userMessageId: string;
}): Promise<{ received: boolean; reply: AssistantUIMessage | null }> {
  const response = await expoFetch(
    `${env.apiUrl}/v1/chats/${opts.chatId}/messages/${opts.userMessageId}?listId=${opts.listId}`,
    { headers: await authorization() },
  );
  if (!response.ok) throw new Error("Could not check the reply yet.");
  return await response.json();
}

export function turnState(parts: Parts): ChatTurnState | null {
  const part = parts.find((part) => part.type === "data-turn");
  return part?.type === "data-turn" ? part.data : null;
}

export function userMessage(
  text: string,
  id: string,
  files: Parts = [],
): AssistantUIMessage {
  const parts: Parts = [...files];
  if (text) parts.push({ type: "text", text });
  return { id, role: "user", parts };
}

export function parseParts(raw: string | null): Parts {
  try {
    return JSON.parse(raw ?? "[]") as Parts;
  } catch {
    return [];
  }
}

/** Text of a message's parts, for rendering and tag parsing. */
export function messageText(parts: Parts): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function suggestionsOf(parts: Parts): string[] {
  const part = parts.find((p) => p.type === "data-suggestions");
  return part && part.type === "data-suggestions" ? part.data : [];
}

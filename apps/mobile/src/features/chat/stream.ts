import { DefaultChatTransport, readUIMessageStream, type UIMessage } from "ai";
import { fetch as expoFetch } from "expo/fetch";

import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/** Mirrors the server's message type: suggested replies ride as a data part. */
export type AssistantUIMessage = UIMessage<never, { suggestions: string[] }>;
export type Parts = AssistantUIMessage["parts"];

/**
 * Sends one user message and yields the assistant reply as it grows
 * (each value is the whole message so far). ADR 9: the server persists both
 * messages; PowerSync brings them back, so the caller only needs to keep
 * the in-flight reply on screen until the row with the same id has synced.
 *
 * expo/fetch, not global fetch: React Native's fetch has no streaming body.
 */
export async function* streamReply(opts: {
  chatId: string;
  listId: string;
  message: AssistantUIMessage;
}): AsyncGenerator<AssistantUIMessage> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const transport = new DefaultChatTransport<AssistantUIMessage>({
    api: `${env.apiUrl}/v1/chats/${opts.chatId}/messages`,
    fetch: expoFetch as unknown as typeof globalThis.fetch,
    headers: { authorization: `Bearer ${token}` },
    // Only the newest message travels; history lives on the server. Local
    // time lets the assistant reason about season and region.
    prepareSendMessagesRequest: ({ messages }) => ({
      body: {
        listId: opts.listId,
        message: messages[messages.length - 1],
        localTime: `${new Date().toString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
      },
    }),
  });

  const stream = await transport.sendMessages({
    trigger: "submit-message",
    chatId: opts.chatId,
    messageId: undefined,
    messages: [opts.message],
    abortSignal: undefined,
  });

  // Without terminateOnError an error part from the server (model 5xx
  // after retries) is swallowed and the stream just ends empty.
  for await (const message of readUIMessageStream<AssistantUIMessage>({
    stream,
    terminateOnError: true,
  })) {
    yield message;
  }
}

export function userMessage(text: string, id: string, files: Parts = []): AssistantUIMessage {
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

/** Whether a tool call is still running, and which. Tool parts are
 *  otherwise invisible: the assistant's own words carry the result. */
export function runningTool(parts: Parts): string | null {
  for (const p of parts) {
    if (!p.type.startsWith("tool-")) continue;
    const state = (p as { state?: string }).state;
    if (state === "input-streaming" || state === "input-available") return p.type.slice("tool-".length);
  }
  return null;
}

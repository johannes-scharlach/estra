import { randomUUID } from "node:crypto";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  APICallError,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  Output,
  RetryError,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
  type Experimental_DownloadFunction,
} from "ai";
import { Hono } from "hono";
import { z } from "zod";

import { ASSISTANT_SYSTEM_PROMPT } from "../assistant-prompt.js";
import type { AppBindings } from "../auth.js";
import { buildChatTools } from "../chat-tools.js";
import { pool } from "../db.js";
import { env } from "../env.js";

export const chats = new Hono<AppBindings>();

const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });

// The conversational turn needs range and reliable tool use; suggestions
// are a cheap utility call.
const CHAT_MODEL =
  process.env.NODE_ENV === "production"
    ? "gemini-flash-latest"
    : "gemini-flash-lite-latest";
const UTILITY_MODEL = "gemini-flash-lite-latest";

/** A chat that ran for a week must not cost a week of tokens per turn. */
const HISTORY_LIMIT = 30;
const TITLE_MAX = 80;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The plan is Estra's own shape, so its guidance lives here rather than in
 * the shared prompt: a calendar of lunch / dinner / treat slots per day, and
 * a shopping list derived from what is planned.
 */
const PLAN_PROMPT = `## The plan

Helping draft a meal plan is a conversation, not permission to save recipes or fill calendar slots. Start from the user's selected dates, meals, notes and any photo; offer a starting point they can shape. Keep draft ideas in the conversation and only save or schedule meals when the user asks you to. Never treat your own suggestions as the user's choices.

The household keeps a plan: a calendar with a lunch, dinner and treat slot per day, and a shopping list that derives itself from what is planned. Read it with readPlan before answering anything about the week. When the user asks to plan a dish, the recipe has to be in the cookbook first — save it with addToCookbook if it is not, then planMeal; both in one go, never asking them to say it twice. A move or a skipped night is one sentence from the user, never a form: unplanMeal and planMeal do the bookkeeping, and you say what moved. When a meal is planned, mention in a few words what will land on the shopping list, so they can strike what they already have — and never ask them to track quantities or keep an inventory. If you are unsure whether something is still around, ask the way one home cook asks another: "is the chard all used up?"`;

/** Suggested replies ride on the assistant message as a data part. */
export type AssistantUIMessage = UIMessage<never, { suggestions: string[] }>;

type MessageRow = {
  id: string;
  role: UIMessage["role"];
  parts: UIMessage["parts"];
};

function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
}

/** The chat is named after its latest Sketch once one exists (ADR 9). */
function sketchTitle(message: UIMessage): string | null {
  const m = /<sketch\s+title="([^"]+)"/.exec(textOf(message));
  return m?.[1]?.trim() || null;
}

const SuggestionsSchema = z.object({
  suggestions: z
    .array(z.string())
    .describe("2-6 short replies the user is most likely to tap next"),
});

async function generateSuggestions(assistantText: string): Promise<string[]> {
  if (!assistantText.trim()) return [];
  const { output } = await generateText({
    model: google(UTILITY_MODEL),
    output: Output.object({ schema: SuggestionsSchema }),
    prompt: `You suggest quick replies in a cooking assistant chat. Below is the assistant's latest message. Propose 2-6 short replies the user is most likely to want to send next, written in the user's voice.

Guidelines:
- If the assistant pitched several ideas (<idea> tags), the user can just tap the idea to expand on it. Offer replies that suggest to merge two of the ideas or substitute an ingredient either for a more seasonal or for a more commonly available one.
- If the assistant sketched out a dish (<sketch> tag: what it's like to eat, what you'd need, how the cooking goes), the first reply is: Save & plan it
- If the assistant just saved a recipe to the cookbook, the first reply is: Plan it for tonight
- Otherwise suggest the most natural next moves (a tweak, a swap, a question about the dish).
- Keep each reply under 8 words. No numbering, no punctuation at the end.
- Write the replies in the same language as the assistant's message. (e.g. if the assistant's message is in French, write the replies in French)

Assistant's message:
${assistantText.slice(-4000)}`,
  });
  return output.suggestions;
}

// The AI SDK's default media downloader refuses loopback/private IP hosts (an
// SSRF guard), which blocks local Supabase storage URLs in dev. This mirrors the
// default behaviour — download only what the model can't fetch itself, pass
// model-supported URLs straight through — but without the host restriction.
//
// In production the model still can't fetch our Supabase URLs, so the bytes are
// downloaded either way; this adds no extra production cost, it only unblocks
// localhost.
export const downloadMedia: Experimental_DownloadFunction = (requests) =>
  Promise.all(
    requests.map(async ({ url, isUrlSupportedByModel }) => {
      if (isUrlSupportedByModel) return null;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to download ${url.href}: ${res.status}`);
      }
      return {
        data: new Uint8Array(await res.arrayBuffer()),
        mediaType: res.headers.get("content-type") ?? undefined,
      };
    }),
  );

/**
 * One friendly line for the phone; the real stack goes to the server log.
 * Provider 5xx (rate limits, capacity) is the common case and is temporary.
 */
function errorTextFor(e: unknown): string {
  if (RetryError.isInstance(e) || APICallError.isInstance(e)) {
    return "The model is busy right now. Try again in a moment.";
  }
  return "Something went wrong on our end. Try again in a moment.";
}

/**
 * ADR 9: the server is the only writer. The body carries just the newest
 * user message; history comes from Postgres, and the reply is persisted
 * under the same id the stream announced, so a client can drop its in-flight
 * copy the moment that row syncs.
 *
 * The chat id is chosen by the client so a fresh chat needs no create call:
 * the first message inserts the row.
 */
chats.post("/:id/messages", async (c) => {
  const chatId = c.req.param("id");
  if (!UUID.test(chatId)) return c.json({ error: "invalid chat id" }, 400);

  const body = await c.req
    .json<{ listId?: unknown; message?: unknown; localTime?: unknown }>()
    .catch(() => ({
      listId: undefined,
      message: undefined,
      localTime: undefined,
    }));
  if (typeof body.listId !== "string" || !UUID.test(body.listId)) {
    return c.json({ error: "listId is required" }, 400);
  }
  const validated = await safeValidateUIMessages({ messages: [body.message] });
  if (!validated.success || validated.data[0]?.role !== "user") {
    return c.json({ error: "message must be a user UIMessage" }, 400);
  }
  const message = validated.data[0];
  const listId = body.listId;
  const localTime =
    typeof body.localTime === "string" ? body.localTime.slice(0, 120) : null;
  const userId = c.get("user").id;

  // The pool bypasses RLS, so membership is checked here, not by Postgres.
  const member = await pool.query(
    "SELECT 1 FROM list_members WHERE list_id = $1 AND user_id = $2",
    [listId, userId],
  );
  if (member.rowCount === 0)
    return c.json({ error: "Not a member of this list" }, 403);

  let history: MessageRow[];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ list_id: string }>(
      "SELECT list_id FROM chats WHERE id = $1",
      [chatId],
    );
    if (existing.rowCount === 0) {
      await client.query(
        "INSERT INTO chats (id, list_id, created_by, title) VALUES ($1, $2, $3, $4)",
        [chatId, listId, userId, textOf(message).slice(0, TITLE_MAX) || null],
      );
    } else if (existing.rows[0]?.list_id !== listId) {
      await client.query("ROLLBACK");
      return c.json({ error: "Chat belongs to another list" }, 403);
    }
    // A retry after a failed turn resends the same message id; keep it a
    // no-op instead of a primary-key error.
    await client.query(
      `INSERT INTO chat_messages (id, chat_id, list_id, role, parts)
       VALUES ($1, $2, $3, 'user', $4::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [message.id, chatId, listId, JSON.stringify(message.parts)],
    );
    const rows = await client.query<MessageRow>(
      `SELECT id, role, parts FROM chat_messages
       WHERE chat_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [chatId, HISTORY_LIMIT],
    );
    await client.query("COMMIT");
    history = rows.rows.reverse();
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("chat message insert failed", e);
    return c.json({ error: "Could not save message" }, 500);
  } finally {
    client.release();
  }

  const uiMessages: AssistantUIMessage[] = history.map((r) => ({
    id: r.id,
    role: r.role,
    parts: r.parts as AssistantUIMessage["parts"],
  }));
  const assistantId = randomUUID();

  const system = [
    ASSISTANT_SYSTEM_PROMPT,
    PLAN_PROMPT,
    localTime
      ? `The user's current local time is ${localTime}. The timezone reflects their broad region — use it for seasonal produce and measurement defaults, not as an exact location.`
      : null,
    "The url returned by addToCookbook or updateRecipe opens the recipe in the app. Share it as a Markdown link on the recipe name.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = streamText({
    model: google(CHAT_MODEL),
    system,
    // A stream that failed mid-tool leaves a call with no result in history;
    // dropping it beats refusing the whole conversation.
    messages: await convertToModelMessages(uiMessages, {
      ignoreIncompleteToolCalls: true,
    }),
    tools: buildChatTools(userId, listId),
    stopWhen: stepCountIs(5),
    // Photos arrive as signed Supabase Storage URLs. Locally that is a
    // private address the SDK's default downloader refuses, so fetch plainly.
    experimental_download: downloadMedia,
  });

  // A phone that backgrounds the app drops the connection mid-stream. The
  // reply is persisted either way, so finish it: it is waiting when they
  // come back, and a tool call in progress is never left half done.
  result.consumeStream();

  const stream = createUIMessageStream<AssistantUIMessage>({
    originalMessages: uiMessages,
    generateId: () => assistantId,
    // The stream's error part is all the phone ever sees of a failure, so
    // keep it to the friendly line and log the real cause here.
    onError: (error) => {
      console.error("chat stream failed", error);
      return errorTextFor(error);
    },
    execute: async ({ writer }) => {
      // Written chunk by chunk rather than merged so the suggestions part is
      // guaranteed to land after the last text, before finish.
      const ui = toUIMessageStream<
        ReturnType<typeof buildChatTools>,
        AssistantUIMessage
      >({
        stream: result.stream,
        sendFinish: false,
      });
      for await (const chunk of ui) writer.write(chunk);

      try {
        const suggestions = await generateSuggestions(await result.text);
        if (suggestions.length)
          writer.write({ type: "data-suggestions", data: suggestions });
      } catch (e) {
        console.error("suggestions failed", e);
      }
      writer.write({ type: "finish" });
    },
    onFinish: async ({ responseMessage }) => {
      try {
        await pool.query(
          `INSERT INTO chat_messages (id, chat_id, list_id, role, parts)
           VALUES ($1, $2, $3, 'assistant', $4::jsonb)`,
          [assistantId, chatId, listId, JSON.stringify(responseMessage.parts)],
        );
        const title = sketchTitle(responseMessage);
        await pool.query(
          title
            ? "UPDATE chats SET title = $2, updated_at = now() WHERE id = $1"
            : "UPDATE chats SET updated_at = now() WHERE id = $1",
          title ? [chatId, title] : [chatId],
        );
      } catch (e) {
        console.error("assistant message insert failed", e);
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
});

import { randomUUID } from "node:crypto";
import {
  householdSchema,
  profileContext,
  type Household,
} from "@estra/profile";

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
import { chatToolErrorText } from "../chat-tool-errors.js";
import { pool } from "../db.js";
import { env } from "../env.js";
import { readChatMeal, readChatVariant } from "../chat-variants.js";
import { AppError } from "../errors.js";
import {
  orderRecipeSeed,
  RecipeContextSchema,
  MealContextSchema,
  recipeChatPrompt,
  recipeSeed,
  type RecipeChat,
} from "../recipe-chat.js";

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
 * a shopping list of explicitly chosen ingredients.
 */
const PLAN_PROMPT = `## The plan

Helping draft a meal plan is a conversation, not permission to save recipes or fill calendar slots. Start from the user's selected dates, meals, notes and any photo; offer a starting point they can shape. Keep draft ideas in the conversation and only save or schedule meals when the user asks you to. Never treat your own suggestions as the user's choices.

The household keeps a plan: a calendar with a lunch, dinner and treat slot per day. Read it with readPlan before answering anything about the week. Meals can be saved recipes or simply written-in names, such as bread and cheese or leftover lasagne. A written meal is already a complete plan and needs no cookbook entry. Planning any meal adds no shopping items: the user separately chooses what to buy, meal by meal. When the user asks to save and plan a new recipe, use addToCookbook then planMeal in one go. In a conversation about a written meal, use readPlannedMeal and addMealShoppingItems to help with shopping without changing the meal into a recipe. Only add shopping items when the user asks for them, and mention actual shopping changes briefly. Never ask them to track quantities or keep an inventory. If you are unsure whether something is still around, ask the way one home cook asks another: "is the chard all used up?"

A planned meal is who from the household is eating plus extra portions. One extra portion is one adult helping that belongs to nobody: guests, leftovers, or just more food. When the user says who is eating ("me" is the current user) and how much extra, size the recipe you save for exactly those people and that extra, say so in its yield, and pass the same eaterIds and extraPortions to planMeal. When they do not say, everyone in the household eats and there is no extra.`;

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
  if (!UUID.test(chatId))
    return c.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid chat ID" } },
      400,
    );

  const body = await c.req
    .json<{
      listId?: unknown;
      message?: unknown;
      localTime?: unknown;
      localDate?: unknown;
      recipeContext?: unknown;
      mealContext?: unknown;
    }>()
    .catch(() => ({
      listId: undefined,
      message: undefined,
      localTime: undefined,
      localDate: undefined,
      recipeContext: undefined,
      mealContext: undefined,
    }));
  if (typeof body.listId !== "string" || !UUID.test(body.listId)) {
    return c.json(
      { error: { code: "INVALID_REQUEST", message: "List ID is required" } },
      400,
    );
  }
  const validated = await safeValidateUIMessages({ messages: [body.message] });
  if (!validated.success || validated.data[0]?.role !== "user") {
    return c.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Message must be a user message",
        },
      },
      400,
    );
  }
  const message = validated.data[0];
  const listId = body.listId;
  const localTime =
    typeof body.localTime === "string" ? body.localTime.slice(0, 120) : null;
  const userId = c.get("user").id;
  const date = z.iso.date().safeParse(body.localDate);
  const today = date.success
    ? date.data
    : new Date().toISOString().slice(0, 10);
  const recipeContext =
    body.recipeContext === undefined
      ? null
      : RecipeContextSchema.safeParse(body.recipeContext);
  if (recipeContext && !recipeContext.success) {
    return c.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid recipe context" } },
      400,
    );
  }
  const start = recipeContext?.success ? recipeContext.data : null;
  const mealContext =
    body.mealContext === undefined
      ? null
      : MealContextSchema.safeParse(body.mealContext);
  if ((mealContext && !mealContext.success) || (mealContext && start)) {
    return c.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid meal context" } },
      400,
    );
  }
  const startMealId = mealContext?.success
    ? mealContext.data.plannedMealId
    : start?.plannedMealId;

  // The pool bypasses RLS, so membership is checked here, not by Postgres.
  const member = await pool.query(
    "SELECT 1 FROM list_members WHERE list_id = $1 AND user_id = $2",
    [listId, userId],
  );
  if (member.rowCount === 0)
    return c.json(
      {
        error: {
          code: "LIST_ACCESS_DENIED",
          message: "Not a member of this list",
        },
      },
      403,
    );

  // Read fresh every turn so edits made in the app reach the next message.
  // A local edit still uploading when the message is sent is seen one turn
  // late; that beats carrying a second copy of the household in the request.
  let household: Household | null = null;
  const profile = await pool.query(
    "SELECT * FROM household_profiles WHERE id = $1",
    [listId],
  );
  if (profile.rows[0]) {
    const people = await pool.query(
      "SELECT * FROM household_people WHERE list_id = $1 ORDER BY created_at, id",
      [listId],
    );
    household = householdSchema.parse({
      profile: profile.rows[0],
      people: people.rows,
    });
  }

  let history: MessageRow[];
  let chat: RecipeChat;
  let initialRecipeRead: UIMessage | null = null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [chatId],
    );
    const existing = await client.query<RecipeChat>(
      "SELECT list_id, recipe_id, initial_variant_id, planned_meal_id, initial_meal_content_id FROM chats WHERE id = $1",
      [chatId],
    );
    if (existing.rowCount === 0) {
      const variant = start
        ? await readChatVariant(client, listId, start.variantId)
        : null;
      const meal = startMealId
        ? await readChatMeal(client, listId, startMealId)
        : null;
      if (meal && meal.variant_id !== (start?.variantId ?? null)) {
        throw new AppError(
          "PLANNED_MEAL_CHANGED",
          "The meal now uses a different version. Open that version to start its chat.",
          409,
        );
      }
      chat = {
        list_id: listId,
        recipe_id: variant?.recipeId ?? null,
        initial_variant_id: variant?.variantId ?? null,
        planned_meal_id: meal?.id ?? null,
        initial_meal_content_id: meal?.content_id ?? null,
      };
      await client.query(
        "INSERT INTO chats (id, list_id, created_by, title, recipe_id, initial_variant_id, planned_meal_id, initial_meal_content_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          chatId,
          listId,
          userId,
          textOf(message).slice(0, TITLE_MAX) || null,
          chat.recipe_id,
          chat.initial_variant_id,
          chat.planned_meal_id,
          chat.initial_meal_content_id,
        ],
      );
      if (variant && start) {
        const previewSwaps = Object.entries(start.previewSwaps ?? {}).map(
          ([index, swapIndex]) => {
            const line = variant.recipeIngredient[Number(index)];
            const swap = line?.swaps?.[swapIndex];
            if (!line || !swap)
              throw new AppError(
                "INVALID_REQUEST",
                "A preview swap is no longer available.",
                400,
              );
            return {
              from: line.item_name,
              to: swap.item_name,
              qtyText: swap.qty_text,
              prepNote: swap.prep_note,
            };
          },
        );
        initialRecipeRead = recipeSeed(randomUUID(), [
          {
            tool: "readVariant",
            input: { variantId: start.variantId },
            output: { ...variant, previewSwaps },
          },
          ...(meal
            ? [
                {
                  tool: "readPlannedMeal",
                  input: { plannedMealId: meal.id },
                  output: meal,
                },
              ]
            : []),
        ]);
      } else if (meal) {
        initialRecipeRead = recipeSeed(randomUUID(), [
          {
            tool: "readPlannedMeal",
            input: { plannedMealId: meal.id },
            output: meal,
          },
        ]);
      }
    } else if (existing.rows[0]?.list_id !== listId) {
      await client.query("ROLLBACK");
      return c.json(
        {
          error: {
            code: "LIST_ACCESS_DENIED",
            message: "Chat belongs to another list",
          },
        },
        403,
      );
    } else {
      chat = existing.rows[0]!;
    }
    // A retry after a failed turn resends the same message id; keep it a
    // no-op instead of a primary-key error.
    await client.query(
      `INSERT INTO chat_messages (id, chat_id, list_id, role, parts, created_at)
       VALUES ($1, $2, $3, 'user', $4::jsonb, now())
       ON CONFLICT (id) DO NOTHING`,
      [message.id, chatId, listId, JSON.stringify(message.parts)],
    );
    // Gemini requires a function call to follow a user turn. The first recipe
    // message therefore initiates the synthetic read; its completed tool call
    // follows that user row instead of preceding the conversation. The small
    // timestamp offset makes their protocol order deterministic inside this
    // transaction (Postgres now() is fixed at transaction start).
    if (initialRecipeRead) {
      await client.query(
        `INSERT INTO chat_messages (id, chat_id, list_id, role, parts, created_at)
         VALUES ($1, $2, $3, 'assistant', $4::jsonb, now() + interval '1 microsecond')`,
        [
          initialRecipeRead.id,
          chatId,
          listId,
          JSON.stringify(initialRecipeRead.parts),
        ],
      );
    }
    const rows = await client.query<MessageRow>(
      `SELECT id, role, parts FROM chat_messages
       WHERE chat_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
      [chatId, HISTORY_LIMIT],
    );
    await client.query("COMMIT");
    history =
      chat.recipe_id || chat.planned_meal_id
        ? orderRecipeSeed(rows.rows.reverse())
        : rows.rows.reverse();
  } catch (e) {
    await client.query("ROLLBACK");
    if (e instanceof AppError)
      return c.json({ error: { code: e.code, message: e.message } }, e.status);
    console.error("chat message insert failed", e);
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: "Could not save message" } },
      500,
    );
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
    recipeChatPrompt(chat),
    household ? profileContext(household, userId) : null,
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
    tools: buildChatTools(userId, listId, {
      chatId,
      messageId: message.id,
      chat,
      today,
    }),
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
        onError: chatToolErrorText,
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
           VALUES ($1, $2, $3, 'assistant', $4::jsonb)
           ON CONFLICT (id) DO UPDATE SET parts = EXCLUDED.parts`,
          [
            responseMessage.id,
            chatId,
            listId,
            JSON.stringify(responseMessage.parts),
          ],
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

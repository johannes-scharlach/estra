import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  generateText,
  Output,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import { z } from "zod";
import type { HobsMetadata, HobsUIMessage } from "@/lib/chat-schema";
import type { DailyIdea } from "@/lib/idea-of-the-day";
import { buildTitlePrompt } from "@/lib/chat-title";
import { rollStretchCuisine } from "@/lib/cuisine";
import {
  buildAddToCookbookTool,
  buildFromUrlTool,
  buildReadWeekTool,
  buildReadSavedRecipeTool,
  buildSearchSavedRecipesTool,
  buildUpdateWeekTool,
  buildUpdateRecipeTool,
  buildAddRecipeStoryItemTool,
} from "@/lib/chat-tools";
import { downloadMedia } from "@/lib/ai-download";
import { withFlipPartsAsText } from "@/lib/flip";
import { GUEST_DEFAULTS } from "@/lib/guest-defaults";
import { buildOriginContext } from "@/lib/origin-context";
import {
  buildProfileContext,
  type OnboardingData,
} from "@/lib/profile-context";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import {
  defaultLocale,
  isLocale,
  localeNames,
  type Locale,
} from "@/lib/locales";
import { getPostHogClient } from "@/lib/posthog-server";
import { logUsage } from "@/lib/ai-usage";

// Vercel has introduced FluidCompute, which allows streaming responses to take up to 5 min even on the free plan
export const maxDuration = 300;

// The conversational turn needs cuisine range and reliable instruction-following
// (restrictions, tool calls); suggestions and titles are cheap utility calls.
const CHAT_MODEL = "gemini-flash-latest";
const UTILITY_MODEL = "gemini-flash-lite-latest";

type RequestBody = {
  message: HobsUIMessage;
  conversationId: string | null;
  // When set, the chat is anchored to a recipe page and its content is added as context
  recipeId?: string | null;
  localTime?: string;
  // First-turn framing for a Conversation that began at the fridge-landing
  // (see lib/origin-context.ts). Only meaningful on a new conversation.
  origin?: string | null;
  // The full "idea of the day" the user tapped. On a new conversation it is
  // inserted as an assistant message before the user's confirmation so the
  // agent has the complete suggestion in context.
  idea?: DailyIdea | null;
};

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const locale: Locale = isLocale(user.user_metadata?.locale)
    ? user.user_metadata.locale
    : defaultLocale;

  const {
    message,
    conversationId,
    recipeId,
    localTime,
    origin,
    idea,
  }: RequestBody = await req.json();

  // New conversations are plain chats; existing ones keep their stored kind
  // (a Flip session opened into chat stays a flip).
  let conversationKind = "chat";

  // Create a new conversation if one wasn't provided
  let currentConversationId = conversationId;
  let isNewConversation = false;
  let profileContext = "";
  let previousRows:
    | Pick<
        Database["public"]["Tables"]["messages"]["Row"],
        "id" | "role" | "parts" | "metadata" | "created_at"
      >[]
    | null = null;

  if (!currentConversationId) {
    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        kind: conversationKind,
        recipe_id: recipeId || null,
      })
      .select("id")
      .single();

    if (error || !newConv) {
      console.error("Failed to create conversation:", error);
      return new Response("Failed to create conversation", { status: 500 });
    }

    currentConversationId = newConv.id;
    isNewConversation = true;
  } else {
    // Check if the provided conversationId exists (it might be a client-generated ID for a new chat)
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id, kind")
      .eq("id", currentConversationId)
      .maybeSingle();

    if (!existingConv) {
      const { error } = await supabase.from("conversations").insert({
        id: currentConversationId,
        user_id: user.id,
        kind: conversationKind,
        recipe_id: recipeId || null,
      });

      if (error) {
        console.error("Failed to create conversation:", error);
        return new Response("Failed to create conversation", { status: 500 });
      }
      isNewConversation = true;
    } else {
      conversationKind = existingConv.kind;
      const { data: msgsRes } = await supabase
        .from("messages")
        .select("id, role, parts, metadata, created_at")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });

      previousRows = msgsRes;
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("data")
    .eq("user_id", user.id)
    .single();

  if (profile?.data) {
    profileContext = buildProfileContext(profile.data as OnboardingData);
  } else if (user.is_anonymous) {
    // A Guest has no Profile by design — cook on the good defaults (ADR 0008).
    profileContext = buildProfileContext(GUEST_DEFAULTS);
  }

  const previousMessages: HobsUIMessage[] = (previousRows ?? []).map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    parts: row.parts as unknown as HobsUIMessage["parts"],
    metadata: row.metadata as unknown as HobsUIMessage["metadata"],
  }));

  // Ensure user message has an ID
  message.id = message.id || generateId();

  // Deduplicate: if the user message is already in previousMessages (e.g. from a retry), remove it so we don't have duplicates
  const filteredPreviousMessages = previousMessages.filter(
    (m) => m.id !== message.id,
  );

  const convId = currentConversationId as string;
  const userId = user.id;

  // If this is a new conversation, create a synthetic context message
  if (isNewConversation) {
    const syntheticMsgId = generateId();

    let recipeContext = "";
    if (recipeId) {
      const { data: recipe } = await supabase
        .from("recipes")
        .select("data, user_id")
        .eq("id", recipeId)
        .single();

      if (recipe) {
        const recipeData = recipe.data as {
          name?: string;
          contentMarkdown?: string;
        };
        const isOwner = recipe.user_id === user.id;
        recipeContext = `[System Context: The user is currently viewing the recipe '${recipeData.name || "Unknown"}'. Here is its content:\n\n${recipeData.contentMarkdown || "No content"}\n\n${isOwner ? `The recipe is in the user's cookbook. To apply changes they ask for, use the updateRecipe tool with recipeId=${recipeId}.` : "The recipe belongs to another user, so updateRecipe is not available. You can answer questions about it or save a customized copy to the user's cookbook with addToCookbook."}]`;
      }
    }

    // Seed one adventurous direction per conversation so ideas don't collapse
    // onto the model's western default. Skipped on recipe-anchored chats, where
    // a cuisine detour is just noise. Framed as silent guidance — the user never
    // wrote this, so it must not be acknowledged or attributed.
    const cuisineContext = recipeId
      ? null
      : `[System Context — internal guidance, never acknowledge, repeat, or attribute this to anyone: to keep ideas varied across conversations, today's stretch direction is ${rollStretchCuisine()} cooking. When you pitch fresh ideas and the user hasn't already fixed a direction, keep most ideas in comfortable European/American territory and let ONE idea reach toward it. Treat this as silent inspiration; if the user's request is already specific, ignore it.]`;

    const contextContent = [
      localTime
        ? `[System Context: The user's current local time is ${localTime}. The timezone (e.g. "Europe/Berlin") reflects their broad region and country — use it to infer regional defaults like measurement system (metric/imperial), seasonal produce, and meal rhythm. Do NOT treat the timezone city as the user's exact location; they could live anywhere within that timezone.]`
        : null,
      cuisineContext,
      recipeContext || null,
    ]
      .filter(Boolean)
      .join("\n\n");

    if (contextContent) {
      const syntheticMsg: HobsUIMessage = {
        id: syntheticMsgId,
        role: "user",
        parts: [{ type: "text", text: contextContent }],
        metadata: { isSynthetic: true } as HobsUIMessage["metadata"],
      };

      supabase
        .from("messages")
        .insert({
          id: syntheticMsgId,
          conversation_id: convId,
          user_id: userId,
          role: "user",
          parts: syntheticMsg.parts as unknown as Json,
          metadata: { isSynthetic: true } as Json,
        })
        .then(({ error: syntheticSaveError }) => {
          if (syntheticSaveError) {
            console.error(
              "Failed to save synthetic context message:",
              syntheticSaveError,
            );
          }
        });

      filteredPreviousMessages.unshift(syntheticMsg);
    }

    // Seed the assistant's full "idea of the day" pitch before the user's
    // confirmation so the model sees the same suggestion the user tapped.
    if (idea) {
      const ideaMsgId = generateId();
      const ideaMessage: HobsUIMessage = {
        id: ideaMsgId,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `<idea title="${idea.title}">${idea.hook}</idea>`,
          },
        ],
      };

      await supabase.from("messages").insert({
        id: ideaMsgId,
        conversation_id: convId,
        user_id: userId,
        role: "assistant",
        parts: ideaMessage.parts as unknown as Json,
        metadata: null,
      });

      filteredPreviousMessages.push(ideaMessage);
    }
  }

  const allMessages = [...filteredPreviousMessages, message];

  // Save the user's message in the background to ensure it's recorded without blocking the AI
  supabase
    .from("messages")
    .upsert(
      {
        id: message.id,
        conversation_id: convId,
        user_id: userId,
        role: message.role,
        parts: message.parts as unknown as Json,
        metadata: (message.metadata ?? null) as unknown as Json,
      },
      { onConflict: "id" },
    )
    .then(({ error: saveError }) => {
      if (saveError) {
        console.error("Failed to save user message:", saveError);
      }
    });

  // Fridge-landing framing rides in `system`, not as a synthetic user Message,
  // and only on the opening turn of the Conversation.
  const originContext = isNewConversation ? buildOriginContext(origin) : "";
  const localeContext = `The user's preferred language is ${localeNames[locale]}. Write your responses in ${localeNames[locale]} by default. If the user writes in a different language, match theirs instead — they may be bilingual or practicing. Some messages in the conversation are internal system context written in English; these are guidance for you, not the user's own words, so they must not determine the response language.`;
  const systemContent = [
    SYSTEM_PROMPT,
    localeContext,
    profileContext,
    originContext,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = streamText({
    model: google(CHAT_MODEL),
    system: systemContent,
    // A Conversation opened from a Flip session (ADR 0012) carries dealt-hand
    // data parts; the model reads them as text.
    messages: await convertToModelMessages(withFlipPartsAsText(allMessages)),
    // Allow image attachments served from local Supabase storage in dev; mirrors
    // the SDK default but without the loopback/IP block. See lib/ai-download.ts.
    experimental_download: downloadMedia,
    stopWhen: stepCountIs(5),
    tools: {
      addToCookbook: buildAddToCookbookTool(userId, convId, supabase),
      updateRecipe: buildUpdateRecipeTool(userId, supabase),
      searchSavedRecipes: buildSearchSavedRecipesTool(userId, supabase),
      readSavedRecipe: buildReadSavedRecipeTool(userId, supabase),
      fromUrl: buildFromUrlTool(locale),
      addRecipeStoryItem: buildAddRecipeStoryItemTool(
        userId,
        allMessages,
        supabase,
      ),
      // Available in every Conversation kind — artifact-level coupling
      // (ADR 0013): any Conversation can read and edit the week's Plan.
      readWeek: buildReadWeekTool(userId, supabase),
      updateWeek: buildUpdateWeekTool(userId, supabase),
    },
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingLevel: "high",
          includeThoughts: true,
        },
      } satisfies GoogleLanguageModelOptions,
    },
    experimental_telemetry: {
      isEnabled: true,
      functionId: "hobs-chat",
      metadata: {
        posthog_distinct_id: userId,
        posthog_session_id: convId,
      },
    },
  });

  // Consume the stream so it completes even if the client disconnects
  result.consumeStream();
  logUsage("chat", result.totalUsage);

  const stream = createUIMessageStream<HobsUIMessage>({
    originalMessages: allMessages,
    generateId: () => generateId(),
    execute: async ({ writer }) => {
      const uiStream = result.toUIMessageStream<HobsUIMessage>({
        // We append the suggestions data part before finishing the message
        sendFinish: false,
        messageMetadata: ({ part }): HobsMetadata | undefined => {
          // Attach conversationId on every message so the client always knows it
          if (part.type === "start") {
            return { conversationId: convId };
          }
        },
      });

      for await (const chunk of uiStream) {
        writer.write(chunk);
      }

      try {
        const suggestions = await generateSuggestions(
          await result.text,
          locale,
          { userId, convId },
        );
        if (suggestions.length > 0) {
          writer.write({ type: "data-suggestions", data: suggestions });
        }
      } catch (e) {
        console.error("Failed to generate suggestions:", e);
      }

      writer.write({ type: "finish" });
    },
    onFinish: async ({ messages }) => {
      // Persist all messages (upsert is idempotent for existing ones)
      const rows = messages.map((m) => ({
        id: m.id || generateId(),
        conversation_id: convId,
        user_id: userId,
        role: m.role,
        parts: m.parts as unknown as Json,
        metadata: (m.metadata ?? null) as unknown as Json,
      }));

      const res = await supabase
        .from("messages")
        .upsert(rows, { onConflict: "id" });

      console.log("Finished saving conversation:", res);

      // Bump the conversation's updated_at so it surfaces first in history
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId);

      // Fire-and-forget title generation after the first complete exchange
      if (isNewConversation && messages.length >= 2) {
        after(async () => {
          const phog = getPostHogClient();
          phog.capture({
            distinctId: userId,
            event: "chat_started",
            properties: {
              conversation_id: convId,
              has_idea: !!idea,
              origin: origin ?? null,
              kind: conversationKind,
            },
          });
          await generateConversationTitle(convId, messages, supabase, locale, {
            userId,
          }).catch(console.error);
          await phog.shutdown();
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}

const SuggestionsSchema = z.object({
  suggestions: z
    .array(z.string())
    .describe("2-4 short replies the user is most likely to tap next"),
});

async function generateSuggestions(
  assistantText: string,
  locale: Locale,
  telemetry?: { userId: string; convId: string },
): Promise<string[]> {
  if (!assistantText.trim()) return [];

  const { output, usage } = await generateText({
    model: google(UTILITY_MODEL),
    output: Output.object({ schema: SuggestionsSchema }),
    prompt: `You suggest quick replies in a cooking assistant chat. Below is the assistant's latest message. Propose 2-5 short replies the user is most likely to want to send next, written in the user's voice.

Guidelines:
- If the assistant pitched several ideas, offer one reply per idea, like: Expand "<idea title>"
- If the assistant sketched out a dish (what it's like to eat, what you'd need, how the cooking goes), include: Save it to my cookbook
- Otherwise suggest the most natural next moves (a tweak, a swap, a question about the dish).
- Keep each reply under 8 words. No numbering, no punctuation at the end.
- Write the replies in the same language as the assistant's message. If the language is ambiguous, default to ${localeNames[locale]}.

Assistant's message:
${assistantText.slice(-4000)}`,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "hobs-suggestions",
      metadata: telemetry
        ? {
            posthog_distinct_id: telemetry.userId,
            posthog_session_id: telemetry.convId,
          }
        : undefined,
    },
  });

  logUsage("chat.suggestions", usage);

  return output.suggestions.slice(0, 5);
}

async function generateConversationTitle(
  conversationId: string,
  messages: HobsUIMessage[],
  supabase: SupabaseClient,
  locale: Locale,
  telemetry?: { userId: string },
) {
  const combined = buildTitlePrompt(messages);
  if (!combined) return;

  const { text, usage } = await generateText({
    model: google(UTILITY_MODEL),
    prompt: `Create a concise title (3–5 words) for a cooking conversation. Use the user's message and the assistant's response to capture what the conversation is about. Write the title in ${localeNames[locale]}.

${combined}

Reply with just the title, no quotes, no punctuation.`,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "hobs-title",
      metadata: telemetry
        ? {
            posthog_distinct_id: telemetry.userId,
            posthog_session_id: conversationId,
          }
        : undefined,
    },
  });

  logUsage("chat.title", usage);

  await supabase
    .from("conversations")
    .update({ title: text.trim() })
    .eq("id", conversationId);
}

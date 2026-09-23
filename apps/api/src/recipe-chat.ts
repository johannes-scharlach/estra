import type { UIMessage } from "ai";
import { z } from "zod";

export const RecipeContextSchema = z.object({
  variantId: z.uuid(),
  plannedMealId: z.uuid().optional(),
  previewSwaps: z
    .record(z.string().regex(/^\d+$/), z.number().int().min(0))
    .optional(),
});

export type RecipeChat = {
  list_id: string;
  recipe_id: string | null;
  initial_variant_id: string | null;
  planned_meal_id: string | null;
};

/** An actual server read, recorded in the same format as later tool reads.
 * It precedes the first user message and stays a historical snapshot. */
export function recipeSeed(
  id: string,
  reads: { tool: string; input: unknown; output: unknown }[],
): UIMessage {
  return {
    id,
    role: "assistant",
    parts: reads.map((read, index) => ({
      type: `tool-${read.tool}`,
      toolCallId: `${id}-${index}`,
      state: "output-available",
      input: read.input,
      output: read.output,
    })),
  };
}

export function recipeChatPrompt(chat: RecipeChat): string | null {
  if (!chat.recipe_id) return null;
  return `## This recipe conversation
Recipe group: ${chat.recipe_id}. Starting variant: ${chat.initial_variant_id ?? "no longer available"}.
${chat.planned_meal_id ? `Associated planned meal: ${chat.planned_meal_id}. Read it with readPlannedMeal before rewriting, to get the current eaters, extra portions, bought ingredients and shopping swaps.` : "This conversation has no associated planned meal."}
The first thing you do is read the initial recipe variant. Use tools like searchVariants and readVariant as needed.
Use updateRecipe to write changes under the same recipe. Supply sizedFor only when you actually sized the recipe for those eaters and extra portions. For an associated upcoming meal, updateRecipe also repoints that meal and replaces its unbought shopping items, preserving bought items. Do not call planMeal to replan the associated meal: that would reset its shopping list. Report the actual returned meal and shopping changes briefly. The app shows a link to the new version and the exact shopping receipt.`;
}

function isRecipeSeed(message: { role: string; parts: unknown }): boolean {
  return (
    message.role === "assistant" &&
    Array.isArray(message.parts) &&
    message.parts.some(
      (part) =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        ((part as { type: unknown }).type === "tool-readVariant" ||
          (part as { type: unknown }).type === "tool-readPlannedMeal"),
    )
  );
}

/** Chats created by the first implementation persisted the synthetic read
 * before the initiating user. Repair their model history in memory so retrying
 * that same turn works; correctly ordered and ordinary histories are unchanged. */
export function orderRecipeSeed<T extends { role: string; parts: unknown }>(
  messages: T[],
): T[] {
  const seedIndex = messages.findIndex(isRecipeSeed);
  if (seedIndex < 0) return messages;
  const userIndex = messages.findIndex((message) => message.role === "user");
  if (userIndex < 0 || seedIndex === userIndex + 1) return messages;
  const next = [...messages];
  const [seed] = next.splice(seedIndex, 1);
  if (!seed) return messages;
  const firstUser = next.findIndex((message) => message.role === "user");
  next.splice(firstUser + 1, 0, seed);
  return next;
}

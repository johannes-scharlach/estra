import { randomUUID } from "node:crypto";

import { tool } from "ai";
import { z } from "zod";

import { pool, inTransaction } from "./db.js";
import { UnknownHouseholdPersonError } from "./errors.js";
import {
  readChatMeal,
  readChatVariant,
  searchChatVariants,
  writeChatVariant,
} from "./chat-variants.js";
import type { RecipeChat } from "./recipe-chat.js";
import {
  clearPlannedMeal,
  MEAL_SLOTS,
  readPlan,
  plannedMealId,
  setPlannedMeal,
} from "./plan.js";
import {
  AddToCookbookSchema,
  CATEGORIES,
  CookRecipeSchema,
} from "./recipe-schema.js";
import { addMealShoppingItems } from "./meal-shopping.js";
import { assertListMemberUntilCommit } from "./list-authorization.js";
import { createRecipe, insertVariant, variantUrl } from "./variants.js";

/**
 * Tools act, never present (ADR 9). Saving lands on the same tables as a URL
 * import; the app opens the returned url on the recipe screen.
 */
export function buildChatTools(
  userId: string,
  listId: string,
  context: {
    chatId: string;
    messageId: string;
    chat: RecipeChat;
    today: string;
  },
) {
  return {
    addMealShoppingItems: tool({
      description: "Add requested shopping items to this conversation's planned meal, including a written-in meal with no recipe. Preserves existing and purchased items; does not save a recipe. Use when the user asks to add items, not merely when suggesting them.",
      inputSchema: z.object({
        items: z.array(z.object({
          name: z.string().trim().min(1).max(200),
          spec: z.string().max(300).optional().describe("Quantity or shopping note, e.g. 1 head or 200g"),
          categoryId: z.enum(CATEGORIES).optional(),
        })).min(1).max(50),
      }),
      execute: async ({ items }) => {
        const plannedMealId = context.chat.planned_meal_id;
        const expectedContentId = context.chat.initial_meal_content_id;
        if (!plannedMealId || !expectedContentId) return { error: "Open a planned meal's shopping chat to add items to it." };
        return inTransaction(async (client) => {
          await assertListMemberUntilCommit(client, userId, listId);
          return addMealShoppingItems(client, { listId, plannedMealId, expectedContentId, items });
        });
      },
    }),
    searchVariants: tool({
      description:
        "Search saved variants by literal text in names, descriptions, ingredients and steps. Results include matching excerpts, creation date, yield and recorded sizing. Scope to a recipeId to browse its versions; an empty query lists newest first. Use readVariant for full content.",
      inputSchema: z.object({
        query: z.string().max(200).default(""),
        recipeId: z.uuid().optional(),
        limit: z.number().int().min(1).max(30).default(10),
      }),
      execute: (input) => searchChatVariants(listId, input),
    }),
    readVariant: tool({
      description:
        "Read the complete saved variant by id, including ingredients, instructions, creation date and sizing.",
      inputSchema: z.object({ variantId: z.uuid() }),
      execute: ({ variantId }) =>
        inTransaction((client) => readChatVariant(client, listId, variantId)),
    }),
    readPlannedMeal: tool({
      description:
        "Read a household planned meal's current variant, eaters, extra portions and shopping items, including which are bought. Read before rewriting a planned meal.",
      inputSchema: z.object({ plannedMealId: z.uuid() }),
      execute: ({ plannedMealId: id }) =>
        inTransaction((client) => readChatMeal(client, listId, id)),
    }),
    readPlan: tool({
      description:
        "What is planned on the household's calendar from a given day, two weeks ahead. Read it before answering anything about the week.",
      inputSchema: z.object({
        fromDate: z.iso
          .date()
          .describe("YYYY-MM-DD, usually today in the user's local time"),
      }),
      execute: async ({ fromDate }) => readPlan(listId, fromDate),
    }),

    planMeal: tool({
      description:
        "Put a saved recipe on the calendar. Adds no shopping items: the user chooses what to buy separately. Replaces whatever was in that slot. Save first if the recipe is not in the cookbook yet. Pass the eaters and extra you sized the recipe for.",
      inputSchema: z.object({
        variantId: z.uuid(),
        date: z.iso.date().describe("YYYY-MM-DD in the user's local time"),
        meal: z.enum(MEAL_SLOTS),
        eaterIds: z
          .array(z.uuid())
          .optional()
          .describe(
            "Household people eating this meal, by id from the household context. Omit when everyone eats.",
          ),
        extraPortions: z
          .number()
          .min(0)
          .multipleOf(0.01)
          .optional()
          .describe(
            "Extra food beyond the eaters, in adult helpings; may be fractional. Omit for none.",
          ),
      }),
      execute: async ({ variantId, date, meal, eaterIds, extraPortions }) => {
        if (
          context.chat.planned_meal_id === plannedMealId(listId, date, meal)
        ) {
          return {
            error:
              context.chat.recipe_id
                ? "Use updateRecipe to revise this conversation's meal; it preserves bought items and updates the meal automatically."
                : "This written meal is already planned. Use addMealShoppingItems for shopping; it needs no recipe.",
          };
        }
        try {
          return await inTransaction((client) =>
            setPlannedMeal(client, {
              listId,
              slotDate: date,
              meal,
              variantId,
              eaterIds,
              extraPortions,
              ifOccupied: "replace",
            }),
          );
        } catch (e) {
          if (e instanceof UnknownHouseholdPersonError)
            return { error: e.message };
          throw e;
        }
      },
    }),

    unplanMeal: tool({
      description:
        "Take a meal off the calendar; its shopping items go with it.",
      inputSchema: z.object({
        date: z.iso.date(),
        meal: z.enum(MEAL_SLOTS),
      }),
      execute: async ({ date, meal }) => ({
        removed: await inTransaction((client) =>
          clearPlannedMeal(client, listId, date, meal),
        ),
      }),
    }),

    addToCookbook: tool({
      description:
        "Save the complete recipe to the user's cookbook. Call only when the user explicitly asks to keep it. Include recipeIngredient as a structured array with quantity, ingredient name, shopping category, and shopping_hint for every ingredient; contentMarkdown and recipeInstructions[].ingredients do not replace it. shopping_hint is a suggestion to check for everyday basics at home, not a claim about inventory or a supermarket aisle. Use contentMarkdown only for useful recipe-specific context not covered by structured fields (such as serving ideas or adaptations), never to repeat ingredients or steps. If you actually sized it for known household eaters, include sizedFor with their household IDs and extra portions; omit when unknown. Returns a url to share as a Markdown link on the recipe name.",
      inputSchema: AddToCookbookSchema,
      execute: async ({ sizedFor, ...recipe }) => {
        try {
          const saved = await inTransaction(async (client) => {
            if (sizedFor) {
              await assertListMemberUntilCommit(client, userId, listId);
              const people = await client.query<{ id: string }>(
                "SELECT id FROM household_people WHERE list_id = $1",
                [listId],
              );
              if (
                sizedFor.eater_ids.some(
                  (id) => !people.rows.some((person) => person.id === id),
                )
              ) {
                throw new UnknownHouseholdPersonError();
              }
            }

            const recipeId = await createRecipe(client, userId);
            return insertVariant(client, {
              recipeId,
              variantId: randomUUID(),
              recipe,
              sizedFor,
            });
          });
          return {
            variantId: saved.variantId,
            name: recipe.name,
            url: variantUrl(saved.variantId),
          };
        } catch (error) {
          if (error instanceof UnknownHouseholdPersonError)
            return { error: error.message };
          throw error;
        }
      },
    }),

    updateRecipe: tool({
      description:
        "Apply an explicitly requested change by writing the complete recipe as a new variant. For this chat's associated upcoming meal, also updates that meal and previously chosen unbought shopping items, preserving bought items. Never adds new ingredients to shopping; the user chooses those separately. Returns a link and the actual shopping changes.",
      inputSchema: z.object({
        variantId: z.uuid().describe("id of the version being changed"),
        recipe: CookRecipeSchema,
        sizedFor: z
          .object({
            eater_ids: z.array(z.uuid()),
            extra_portions: z.number().min(0).multipleOf(0.01),
          })
          .optional()
          .describe(
            "Record only when this recipe was actually sized for these household eaters and extra portions.",
          ),
      }),
      execute: ({ variantId, recipe, sizedFor }) =>
        writeChatVariant({
          userId,
          listId,
          ...context,
          baseVariantId: variantId,
          recipe,
          sizedFor,
        }),
    }),

    searchSavedRecipes: tool({
      description:
        "Look up recipes in the user's cookbook by name or ingredient. Use before writing a sauce, dressing or dough the user may have their own version of.",
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: async ({ query }) => {
        const like = `%${query}%`;
        const rows = await pool.query<{
          id: string;
          name: string | null;
          description: string | null;
          total_time: string | null;
          ingredient_lines: { item_name: string }[];
        }>(
          `SELECT id, name, description, total_time, ingredient_lines FROM variants
           WHERE name ILIKE $1 OR description ILIKE $1 OR ingredient_lines::text ILIKE $1
           ORDER BY created_at DESC LIMIT 10`,
          [like],
        );
        return rows.rows.map((r) => ({
          variantId: r.id,
          name: r.name,
          description: r.description,
          totalTime: r.total_time,
          ingredients: r.ingredient_lines.map((l) => l.item_name),
          url: variantUrl(r.id),
        }));
      },
    }),
  };
}

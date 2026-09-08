import { randomUUID } from "node:crypto";

import { tool } from "ai";
import { z } from "zod";

import { pool, inTransaction } from "./db.js";
import {
  clearPlannedMeal,
  MEAL_SLOTS,
  readPlan,
  setPlannedMeal,
} from "./plan.js";
import { RecipeSchema } from "./recipe-schema.js";
import { createRecipe, insertVariant, variantUrl } from "./variants.js";

// The assistant writes recipes from the conversation; provenance is the chat.
const CookRecipeSchema = RecipeSchema.omit({ from: true });

/**
 * Tools act, never present (ADR 9). Saving lands on the same tables as a URL
 * import; the app opens the returned url on the recipe screen.
 */
export function buildChatTools(userId: string, listId: string) {
  return {
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
        "Put a saved recipe on the calendar. Its ingredients land on the shopping list automatically; the result says which. Replaces whatever was in that slot. Save first if the recipe is not in the cookbook yet.",
      inputSchema: z.object({
        variantId: z.uuid(),
        date: z.iso.date().describe("YYYY-MM-DD in the user's local time"),
        meal: z.enum(MEAL_SLOTS),
        servings: z.number().int().min(1).max(20).optional(),
      }),
      execute: async ({ variantId, date, meal, servings }) =>
        inTransaction((client) =>
          setPlannedMeal(client, {
            listId,
            slotDate: date,
            meal,
            variantId,
            servings,
            ifOccupied: "replace",
          }),
        ),
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
        "Save the complete recipe to the user's cookbook. Call only when the user explicitly asks to keep it. Returns a url to share as a Markdown link on the recipe name.",
      inputSchema: CookRecipeSchema,
      execute: async (recipe) => {
        const saved = await inTransaction(async (client) => {
          const recipeId = await createRecipe(client, userId);
          return insertVariant(client, {
            recipeId,
            variantId: randomUUID(),
            recipe,
          });
        });
        return {
          variantId: saved.variantId,
          name: recipe.name,
          url: variantUrl(saved.variantId),
        };
      },
    }),

    updateRecipe: tool({
      description:
        "Apply a change the user asked for to a recipe already in their cookbook, by writing the complete updated recipe as a new version. Returns the url of the new version.",
      inputSchema: z.object({
        variantId: z.uuid().describe("id of the version being changed"),
        recipe: CookRecipeSchema,
      }),
      execute: async ({ variantId, recipe }) => {
        const row = await pool.query<{ recipe_id: string }>(
          "SELECT recipe_id FROM variants WHERE id = $1",
          [variantId],
        );
        const recipeId = row.rows[0]?.recipe_id;
        if (!recipeId) return { error: "No such recipe" };
        const saved = await inTransaction((client) =>
          insertVariant(client, { recipe, recipeId, variantId: randomUUID() }),
        );
        return {
          variantId: saved.variantId,
          name: recipe.name,
          url: variantUrl(saved.variantId),
        };
      },
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

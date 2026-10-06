import { mealIngredients, resolveMealItem, type MealSwaps, type SizedFor } from "@estra/meals";
import type { Client } from "pg";

import { inTransaction, pool } from "./db.js";
import {
  AppError,
  UnknownHouseholdPersonError,
  VariantNotFoundError,
} from "./errors.js";
import { estraUuidV5 } from "./estra-uuid.js";
import { assertListMemberUntilCommit } from "./list-authorization.js";
import type { CookRecipeInput } from "./recipe-schema.js";
import type { RecipeChat } from "./recipe-chat.js";
import type { ShoppingItem } from "./shopping-revision.js";
import { repointMealVariant } from "./reconcile-meal-shopping.js";
import { findVariantIdentity, insertVariant, variantUrl } from "./variants.js";

type VariantRow = {
  id: string;
  recipe_id: string;
  name: string;
  description: string | null;
  created_at: Date;
  recipe_yield: string | null;
  total_time: string | null;
  sized_for: SizedFor | null;
  ingredient_lines: CookRecipeInput["recipeIngredient"];
  instructions: CookRecipeInput["recipeInstructions"];
  locale: string;
  content_markdown: string | null;
  recipe_category: string | null;
  recipe_cuisine: string | null;
};

const dbFields = `id, recipe_id, name, description, created_at, recipe_yield,
  total_time, sized_for, ingredient_lines, instructions, locale,
  content_markdown, recipe_category, recipe_cuisine`;

async function sizing(client: Client, listId: string, value: SizedFor | null) {
  if (!value) return null;
  const people = await client.query<{ id: string; name: string }>(
    "SELECT id, name FROM household_people WHERE list_id = $1 AND id = ANY($2::uuid[])",
    [listId, value.eater_ids],
  );
  return {
    eaterIds: value.eater_ids,
    eaters: people.rows,
    extraPortions: value.extra_portions,
  };
}

async function summary(client: Client, listId: string, row: VariantRow) {
  return {
    variantId: row.id,
    recipeId: row.recipe_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    yield: row.recipe_yield,
    totalTime: row.total_time,
    sizedFor: await sizing(client, listId, row.sized_for),
    url: variantUrl(row.id),
  };
}

export async function readChatVariant(
  client: Client,
  listId: string,
  variantId: string,
) {
  const row = (
    await client.query<VariantRow>(
      `SELECT ${dbFields} FROM variants WHERE id = $1`,
      [variantId],
    )
  ).rows[0];
  if (!row) throw new VariantNotFoundError();
  return {
    ...(await summary(client, listId, row)),
    recipeIngredient: row.ingredient_lines,
    recipeInstructions: row.instructions,
    locale: row.locale,
    contentMarkdown: row.content_markdown,
    recipeCategory: row.recipe_category,
    recipeCuisine: row.recipe_cuisine,
  };
}

/** A bounded literal search. Matches carry their field and excerpt, alongside
 * metadata; reading a complete version is a separate operation. */
export async function searchChatVariants(
  listId: string,
  opts: { query: string; recipeId?: string; limit: number },
) {
  const client = await pool.connect();
  try {
    const pattern = `%${opts.query.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = await client.query<VariantRow>(
      `SELECT ${dbFields} FROM variants
       WHERE ($1::uuid IS NULL OR recipe_id = $1)
         AND (name ILIKE $2 OR description ILIKE $2 OR ingredient_lines::text ILIKE $2 OR instructions::text ILIKE $2)
       ORDER BY created_at DESC, id LIMIT $3`,
      [opts.recipeId ?? null, pattern, opts.limit + 1],
    );
    const query = opts.query.toLowerCase();
    const matches = await Promise.all(
      rows.rows.slice(0, opts.limit).map(async (row) => {
        const fields = [
          { field: "name", text: row.name },
          { field: "description", text: row.description ?? "" },
          ...row.ingredient_lines.map((line, index) => ({
            field: `ingredients[${index}]`,
            text: JSON.stringify(line),
          })),
          ...row.instructions.map((step, index) => ({
            field: `steps[${index}]`,
            text: JSON.stringify(step),
          })),
        ];
        return {
          ...(await summary(client, listId, row)),
          matches: query
            ? fields
                .filter(({ text }) => text.toLowerCase().includes(query))
                .slice(0, 4)
                .map(({ field, text }) => {
                  const start = Math.max(
                    0,
                    text.toLowerCase().indexOf(query) - 60,
                  );
                  return { field, excerpt: text.slice(start, start + 240) };
                })
            : [],
        };
      }),
    );
    return { variants: matches, hasMore: rows.rows.length > opts.limit };
  } finally {
    client.release();
  }
}

export async function readChatMeal(
  client: Client,
  listId: string,
  plannedMealId: string,
) {
  const meal = (
    await client.query<{
      id: string;
      recipe_id: string | null;
      variant_id: string | null;
      name: string | null;
      content_id: string;
      slot_date: string;
      meal: string;
      eater_ids: string[];
      extra_portions: number;
      ingredient_swaps: MealSwaps;
    }>("SELECT * FROM planned_meals WHERE id = $1 AND list_id = $2", [
      plannedMealId,
      listId,
    ])
  ).rows[0];
  if (!meal)
    throw new AppError(
      "PLANNED_MEAL_NOT_FOUND",
      "This meal is no longer on this household's plan.",
      404,
    );
  const items = (
    await client.query<ShoppingItem>(
      "SELECT id, name, spec, category_id, status, ingredient_id FROM list_items WHERE planned_meal_id = $1 ORDER BY created_at, id",
      [meal.id],
    )
  ).rows;
  const variant = meal.variant_id ? await readChatVariant(client, listId, meal.variant_id) : null;
  const lines = variant?.recipeIngredient ?? [];
  return {
    ...meal,
    ingredientChoices: mealIngredients(lines, meal.ingredient_swaps),
    sizedFor: await sizing(client, listId, {
      eater_ids: meal.eater_ids,
      extra_portions: meal.extra_portions,
    }),
    items: items.map((item) => resolveMealItem(item, lines, meal.ingredient_swaps)),
  };
}

/** One user turn and base version identify a write, including retries after
 * a lost stream. Meal repointing and shopping changes commit with the variant. */
export async function writeChatVariant(opts: {
  userId: string;
  listId: string;
  chatId: string;
  messageId: string;
  chat: RecipeChat;
  today: string;
  baseVariantId: string;
  recipe: CookRecipeInput;
  sizedFor?: SizedFor;
}) {
  return inTransaction(opts.userId, async (client) => {
    await assertListMemberUntilCommit(client, opts.userId, opts.listId);
    const variantId = estraUuidV5(
      `chat:${opts.chatId}:${opts.messageId}:${opts.baseVariantId}`,
    );
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [variantId],
    );
    const existing = await findVariantIdentity(client, variantId);
    if (existing) {
      const variant = await readChatVariant(client, opts.listId, variantId);
      return {
        variantId,
        name: variant.name,
        url: variantUrl(variantId),
        alreadySaved: true,
      };
    }
    const base = await findVariantIdentity(client, opts.baseVariantId);
    if (!base) throw new VariantNotFoundError();
    if (opts.sizedFor) {
      const people = await client.query<{ id: string }>(
        "SELECT id FROM household_people WHERE list_id = $1",
        [opts.listId],
      );
      if (
        opts.sizedFor.eater_ids.some(
          (id) => !people.rows.some((person) => person.id === id),
        )
      )
        throw new UnknownHouseholdPersonError();
    }
    await insertVariant(client, {
      recipeId: base.recipeId,
      variantId,
      recipe: opts.recipe,
      baseVariantId: opts.baseVariantId,
      sizedFor: opts.sizedFor,
    });
    let plannedMeal: { id: string; date: string; meal: string } | null = null;
    let shopping: Awaited<ReturnType<typeof repointMealVariant>> | null = null;
    if (opts.chat.planned_meal_id && opts.chat.recipe_id === base.recipeId) {
      const meal = (
        await client.query<{ id: string; slot_date: string; meal: string; variant_id: string }>(
          "SELECT id, slot_date, meal, variant_id FROM planned_meals WHERE id = $1 AND list_id = $2 AND recipe_id = $3 AND slot_date >= $4 FOR UPDATE",
          [opts.chat.planned_meal_id, opts.listId, base.recipeId, opts.today],
        )
      ).rows[0];
      if (meal) {
        shopping = await repointMealVariant(client, { mealId: meal.id, variantId, expectedVariantId: meal.variant_id });
        plannedMeal = { id: meal.id, date: meal.slot_date, meal: meal.meal };
      }
    }
    return {
      variantId,
      name: opts.recipe.name,
      url: variantUrl(variantId),
      plannedMeal,
      shopping,
    };
  });
}

import { randomUUID } from "node:crypto";
import { ingredientOptions, ingredientSpec, itemNameKey, lineForItem, type IngredientLine, type MealSwaps } from "@estra/meals";
import type { PoolClient } from "pg";

import { AppError } from "./errors.js";
import type { CategoryId } from "./recipe-schema.js";

/** Add to the named meal, never turn shopping help into a recipe rewrite.
 * Lock the meal so concurrent requests and retries cannot duplicate items. */
export async function addMealShoppingItems(
  client: PoolClient,
  opts: {
    listId: string;
    plannedMealId: string;
    expectedContentId: string;
    items: { name: string; spec?: string; categoryId?: CategoryId }[];
  },
) {
  const meal = (
    await client.query<{
      id: string;
      variant_id: string | null;
      content_id: string;
      ingredient_swaps: MealSwaps;
    }>(
      "SELECT id, variant_id, content_id, ingredient_swaps FROM planned_meals WHERE id = $1 AND list_id = $2 FOR UPDATE",
      [opts.plannedMealId, opts.listId],
    )
  ).rows[0];
  if (!meal)
    throw new AppError(
      "PLANNED_MEAL_NOT_FOUND",
      "This meal is no longer planned.",
      404,
    );
  if (meal.content_id !== opts.expectedContentId) {
    throw new AppError(
      "PLANNED_MEAL_CHANGED",
      "This meal has moved or been replaced. Open its shopping chat from the meal again.",
      409,
    );
  }
  const added: string[] = [];
  const alreadyOnList: string[] = [];
  const lines = meal.variant_id ? (await client.query<{ ingredient_lines: IngredientLine[] }>(
    "SELECT ingredient_lines FROM variants WHERE id = $1", [meal.variant_id],
  )).rows[0]?.ingredient_lines ?? [] : [];
  const swaps = { ...meal.ingredient_swaps };
  for (const item of opts.items) {
    const name = item.name.trim();
    const key = itemNameKey(name);
    // Chat supplies names at this boundary; persist identity once, never use
    // the name again to follow subsequent meal edits. Ambiguity stays unlinked.
    const line = lineForItem(name, lines)?.line;
    const ingredientId = line?.id ?? null;
    const existing = await client.query(
      "SELECT id FROM list_items WHERE planned_meal_id = $1 AND (ingredient_id = $3 OR (ingredient_id IS NULL AND name_key = $2))",
      [meal.id, key, ingredientId],
    );
    if (existing.rowCount) {
      alreadyOnList.push(name);
      continue;
    }
    const optionIndex = line ? ingredientOptions(line).findIndex((option) => itemNameKey(option.item_name) === key) : 0;
    const option = line ? ingredientOptions(line)[optionIndex] : null;
    if (ingredientId != null) {
      if (optionIndex > 0) swaps[ingredientId] = optionIndex;
      else delete swaps[ingredientId];
    }
    await client.query(
      `INSERT INTO list_items (id, list_id, name, name_key, spec, category_id, status, planned_meal_id, variant_id, ingredient_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9)`,
      [
        randomUUID(),
        opts.listId,
        name,
        key,
        option ? ingredientSpec(option) : item.spec ?? null,
        option?.category_id ?? item.categoryId ?? null,
        meal.id,
        meal.variant_id,
        ingredientId,
      ],
    );
    added.push(name);
  }
  if (meal.variant_id) await client.query("UPDATE planned_meals SET ingredient_swaps = $2::jsonb WHERE id = $1", [meal.id, JSON.stringify(swaps)]);
  return { plannedMealId: meal.id, added, alreadyOnList };
}

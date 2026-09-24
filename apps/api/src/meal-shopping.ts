import { randomUUID } from "node:crypto";
import { itemNameKey } from "@estra/meals";
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
    }>(
      "SELECT id, variant_id, content_id FROM planned_meals WHERE id = $1 AND list_id = $2 FOR UPDATE",
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
  for (const item of opts.items) {
    const name = item.name.trim();
    const key = itemNameKey(name);
    const existing = await client.query(
      "SELECT id FROM list_items WHERE planned_meal_id = $1 AND name_key = $2",
      [meal.id, key],
    );
    if (existing.rowCount) {
      alreadyOnList.push(name);
      continue;
    }
    await client.query(
      `INSERT INTO list_items (id, list_id, name, name_key, spec, category_id, status, planned_meal_id, variant_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)`,
      [
        randomUUID(),
        opts.listId,
        name,
        key,
        item.spec ?? null,
        item.categoryId ?? null,
        meal.id,
        meal.variant_id,
      ],
    );
    added.push(name);
  }
  return { plannedMealId: meal.id, added, alreadyOnList };
}

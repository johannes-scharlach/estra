import {
  ingredientSpec,
  mealIngredients,
  rebaseMealSwaps,
  resolveMealItem,
  type IngredientLine,
  type MealSwaps,
} from "@estra/meals";
import type { PoolClient } from "pg";

import { AppError, PlannedMealChangedError } from "./errors.js";
import { shoppingRevision, type ShoppingItem } from "./shopping-revision.js";

/** Caller owns the transaction that also inserts the variant. */
export async function repointMealVariant(
  client: PoolClient,
  opts: {
    mealId: string;
    variantId: string;
    expectedVariantId: string;
    expectedSwaps?: MealSwaps;
  },
) {
  const meal = (await client.query<{ ingredient_swaps: MealSwaps }>(
    "SELECT ingredient_swaps FROM planned_meals WHERE id = $1 AND variant_id = $2 FOR UPDATE",
    [opts.mealId, opts.expectedVariantId],
  )).rows[0];
  if (!meal) throw new PlannedMealChangedError();
  const previous = (await client.query<{ ingredient_lines: IngredientLine[] }>(
    "SELECT ingredient_lines FROM variants WHERE id = $1", [opts.expectedVariantId],
  )).rows[0];
  const next = (await client.query<{ ingredient_lines: IngredientLine[] }>(
    "SELECT ingredient_lines FROM variants WHERE id = $1", [opts.variantId],
  )).rows[0];
  if (!previous || !next) throw new Error("Variant not found");
  const swaps = (() => {
    try {
      return rebaseMealSwaps(
        previous.ingredient_lines, meal.ingredient_swaps, next.ingredient_lines,
      );
    } catch (cause) {
      throw new AppError(
        "MEAL_CHOICES_NOT_PRESERVED",
        "The revised recipe must incorporate the meal's ingredient choices or retain them as alternatives. Read the meal again and retry.",
        422,
        { cause },
      );
    }
  })();
  const items = (await client.query<ShoppingItem>(
    `SELECT id, name, spec, category_id, status, ingredient_id FROM list_items
     WHERE planned_meal_id = $1 ORDER BY created_at, id FOR UPDATE`,
    [opts.mealId],
  )).rows;
  const currentItems = items.map((item) =>
    resolveMealItem(item, previous.ingredient_lines, meal.ingredient_swaps),
  );
  const nextLines = mealIngredients(next.ingredient_lines, swaps).map(
    ({ line, chosen }) => ({ ...chosen, id: line.id }),
  );
  const revision = shoppingRevision(currentItems, nextLines);
  const result = await client.query(
    `UPDATE planned_meals SET variant_id = $1, shopping_reviewed_variant_id = NULL,
      ingredient_swaps = $5::jsonb, updated_at = now()
     WHERE id = $2 AND variant_id = $3 AND ($4::jsonb IS NULL OR ingredient_swaps = $4::jsonb)`,
    [
      opts.variantId,
      opts.mealId,
      opts.expectedVariantId,
      opts.expectedSwaps ? JSON.stringify(opts.expectedSwaps) : null,
      JSON.stringify(swaps),
    ],
  );
  if (!result.rowCount) throw new PlannedMealChangedError();
  // Reconcile links, not names. Purchased details remain the check-off snapshot.
  await client.query(
    "DELETE FROM list_items WHERE id = ANY($1::uuid[]) AND status <> 'purchased'",
    [revision.removed.map((item) => item.id)],
  );
  await client.query(
    "UPDATE list_items SET variant_id = $1 WHERE planned_meal_id = $2",
    [opts.variantId, opts.mealId],
  );
  return {
    added: [] as string[],
    removed: revision.removed.map((item) => item.name),
    updated: revision.kept
      .filter(({ item, line }) =>
        item.name !== line.item_name || item.spec !== ingredientSpec(line),
      )
      .map(({ line }) =>
        [line.qty_text, line.item_name].filter(Boolean).join(" "),
      ),
    keptBought: revision.bought.map((item) => item.name),
  };
}

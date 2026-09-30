import { itemNameKey, parseMealSwaps, type MealItem } from "@estra/meals";
import * as Crypto from "expo-crypto";

import {
  ingredientSpec,
  optionsForLine,
  shoppingReview,
} from "@/features/meals/shopping-review";
import { powersync } from "./system";
import { getVariant } from "./variants";

/** Save the household's review and chosen shopping options. Re-read inside the
 * transaction so retries preserve purchased rows. */
export async function saveMealShoppingReview(opts: {
  listId: string;
  mealId: string;
  contentId: string;
  variantId: string;
  selections: { lineIndex: number; optionIndex: number }[];
  /** Includes choices for ingredients already at home. */
  choices?: { lineIndex: number; optionIndex: number }[];
}): Promise<void> {
  await powersync.writeTransaction(async (tx) => {
    const meal = await tx.getOptional<{
      content_id: string;
      variant_id: string | null;
      ingredient_swaps: string | null;
    }>(
      "SELECT content_id, variant_id, ingredient_swaps FROM planned_meals WHERE id = ? AND list_id = ?",
      [opts.mealId, opts.listId],
    );
    if (
      !meal ||
      meal.content_id !== opts.contentId ||
      meal.variant_id !== opts.variantId
    )
      throw new Error("This meal has changed. Open its ingredients again.");
    const variant = await getVariant(tx, opts.variantId);
    if (!variant)
      throw new Error("The recipe hasn't synced yet. Try again shortly.");
    const items = await tx.getAll<MealItem & { id: string }>(
      "SELECT id, name, spec, status, ingredient_id FROM list_items WHERE planned_meal_id = ?",
      [opts.mealId],
    );
    const swaps = parseMealSwaps(meal.ingredient_swaps);
    const review = shoppingReview(variant.ingredientLines, items, swaps);
    const selected = new Map(
      opts.selections.map(({ lineIndex, optionIndex }) => [
        lineIndex,
        optionIndex,
      ]),
    );
    if (
      [...selected].some(
        ([index, optionIndex]) =>
          !Number.isInteger(index) ||
          !review[index] ||
          !Number.isInteger(optionIndex) ||
          optionIndex < 0 ||
          optionIndex >= optionsForLine(variant.ingredientLines[index]!).length,
      ) ||
      selected.size !== opts.selections.length
    )
      throw new Error("These ingredients have changed. Open them again.");
    for (const { lineIndex, optionIndex } of opts.choices ?? opts.selections) {
      const line = variant.ingredientLines[lineIndex];
      if (
        !Number.isInteger(lineIndex) ||
        !line?.id ||
        !Number.isInteger(optionIndex) ||
        !optionsForLine(line)[optionIndex]
      )
        throw new Error("These ingredients have changed. Open them again.");
      if (optionIndex) swaps[line.id] = optionIndex;
      else delete swaps[line.id];
    }
    const now = new Date().toISOString();
    await tx.execute(
      "UPDATE planned_meals SET shopping_reviewed_variant_id = ?, ingredient_swaps = ?, updated_at = ? WHERE id = ?",
      [opts.variantId, JSON.stringify(swaps), now, opts.mealId],
    );
    for (const { index, line, item } of review) {
      const optionIndex = selected.get(index);
      if (item?.status === "purchased") continue;
      if (optionIndex === undefined) {
        if (item)
          await tx.execute("DELETE FROM list_items WHERE id = ?", [item.id]);
        continue;
      }
      const option = optionsForLine(line)[optionIndex];
      if (!option || !line.id)
        throw new Error("These ingredients have changed. Open them again.");
      if (item) {
        continue;
      }
      await tx.execute(
        `INSERT INTO list_items (id, list_id, name, name_key, category_id, spec, status, purchase_count, created_at, updated_at, planned_meal_id, variant_id, ingredient_id)
          VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?, ?, ?)`,
        [
          Crypto.randomUUID(),
          opts.listId,
          option.item_name,
          itemNameKey(option.item_name),
          option.category_id ?? null,
          ingredientSpec(option),
          now,
          now,
          opts.mealId,
          opts.variantId,
          line.id,
        ],
      );
    }
  });
}

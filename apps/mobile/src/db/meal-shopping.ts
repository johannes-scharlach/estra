import { itemNameKey, parseMealSwaps, type MealItem } from "@estra/meals";
import * as Crypto from "expo-crypto";

import {
  ingredientSpec,
  optionsForLine,
  shoppingReview,
  undecidedCount,
} from "@/features/meals/shopping-review";
import { powersync } from "./system";
import { getVariant } from "./variants";

export function parseAtHome(raw: string | null | undefined): number[] {
  try {
    const ids: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(ids) ? ids.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

/** Save one shopping decision for some of a meal's ingredients. Purchases stay
 * purchases. The meal counts as reviewed while nothing is left undecided. */
export async function decideIngredients(opts: {
  listId: string;
  mealId: string;
  contentId: string;
  variantId: string;
  ingredientIds: number[];
  decision: "shop" | "home" | "undecided";
}): Promise<void> {
  await powersync.writeTransaction(async (tx) => {
    const meal = await tx.getOptional<{
      content_id: string;
      variant_id: string | null;
      ingredient_swaps: string | null;
      ingredients_at_home: string | null;
    }>(
      "SELECT content_id, variant_id, ingredient_swaps, ingredients_at_home FROM planned_meals WHERE id = ? AND list_id = ?",
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
    let items = await tx.getAll<MealItem & { id: string }>(
      "SELECT id, name, spec, status, ingredient_id FROM list_items WHERE planned_meal_id = ?",
      [opts.mealId],
    );
    const swaps = parseMealSwaps(meal.ingredient_swaps);
    const review = shoppingReview(variant.ingredientLines, items, swaps);
    const entries = opts.ingredientIds.map((id) =>
      review.find((entry) => entry.line.id === id),
    );
    if (entries.some((entry) => !entry))
      throw new Error("These ingredients have changed. Open them again.");

    const now = new Date().toISOString();
    const atHome = new Set(parseAtHome(meal.ingredients_at_home));
    for (const entry of entries) {
      const { line, item, optionIndex } = entry!;
      const id = line.id!;
      if (opts.decision === "home") atHome.add(id);
      else atHome.delete(id);
      if (item?.status === "purchased") continue;
      if (opts.decision !== "shop") {
        if (item) {
          await tx.execute("DELETE FROM list_items WHERE id = ?", [item.id]);
          items = items.filter((other) => other !== item);
        }
        continue;
      }
      if (item) continue;
      const option = optionsForLine(line)[optionIndex] ?? line;
      const created = {
        id: Crypto.randomUUID(),
        name: option.item_name,
        spec: ingredientSpec(option),
        status: "active",
        ingredient_id: id,
      };
      items.push(created);
      await tx.execute(
        `INSERT INTO list_items (id, list_id, name, name_key, category_id, spec, status, purchase_count, created_at, updated_at, planned_meal_id, variant_id, ingredient_id)
          VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?, ?, ?)`,
        [
          created.id,
          opts.listId,
          created.name,
          itemNameKey(created.name),
          option.category_id ?? null,
          created.spec,
          now,
          now,
          opts.mealId,
          opts.variantId,
          id,
        ],
      );
    }
    const decided = shoppingReview(
      variant.ingredientLines, items, swaps, [...atHome],
    );
    await tx.execute(
      "UPDATE planned_meals SET ingredients_at_home = ?, shopping_reviewed_variant_id = ?, updated_at = ? WHERE id = ?",
      [
        JSON.stringify([...atHome]),
        undecidedCount(decided) ? null : opts.variantId,
        now,
        opts.mealId,
      ],
    );
  });
}

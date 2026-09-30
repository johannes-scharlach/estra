import { ingredientOptions, parseMealSwaps, resolveMealItem } from "@estra/meals";

import type { ListItem } from "./schema";
import { powersync } from "./system";
import { getVariant, parseIngredientLines } from "./variants";

export type MealItemContext = {
  ingredient_lines: string | null;
  ingredient_swaps: string | null;
};

export function resolveShoppingItem<I extends ListItem & MealItemContext>(
  item: I,
): I {
  if (item.status === "purchased" || item.ingredient_id == null) return item;
  return resolveMealItem(
    item,
    parseIngredientLines(item.ingredient_lines),
    parseMealSwaps(item.ingredient_swaps),
  );
}

type Transaction = Parameters<Parameters<typeof powersync.writeTransaction>[0]>[0];

/** The same meal write, whether the user is cooking, reviewing or shopping. */
export async function writeMealSwap(
  tx: Transaction,
  opts: {
    mealId: string;
    variantId: string;
    ingredientId: number;
    name: string;
  },
) {
  const meal = await tx.getOptional<{
    variant_id: string;
    ingredient_swaps: string | null;
  }>(
    "SELECT variant_id, ingredient_swaps FROM planned_meals WHERE id = ?",
    [opts.mealId],
  );
  if (!meal || meal.variant_id !== opts.variantId) {
    throw new Error("This meal has changed. Open it again.");
  }
  const variant = await getVariant(tx, meal.variant_id);
  const line = variant?.ingredientLines.find((line) => line.id === opts.ingredientId);
  const index = line
    ? ingredientOptions(line).findIndex((option) => option.item_name === opts.name)
    : -1;
  if (index < 0) throw new Error("This ingredient has changed. Open it again.");
  const swaps = parseMealSwaps(meal.ingredient_swaps);
  if (index) swaps[opts.ingredientId] = index;
  else delete swaps[opts.ingredientId];
  await tx.execute(
    "UPDATE planned_meals SET ingredient_swaps = ?, updated_at = ? WHERE id = ?",
    [JSON.stringify(swaps), new Date().toISOString(), opts.mealId],
  );
}

export async function setMealSwap(opts: Parameters<typeof writeMealSwap>[1]) {
  await powersync.writeTransaction((tx) => writeMealSwap(tx, opts));
}

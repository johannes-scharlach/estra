import {
  ingredientOptions,
  mealIngredients,
  type IngredientLine,
  type MealItem,
  type MealSwaps,
} from "@estra/meals";

export { ingredientSpec } from "@estra/meals";
export const optionsForLine = ingredientOptions;

export function probablyAtHome(line: IngredientLine): boolean {
  return line.shopping_hint === "check_at_home";
}

/** Shopping selection and ingredient choice are independent, joined by identity. */
export function shoppingReview<L extends IngredientLine, I extends MealItem>(
  lines: readonly L[],
  items: readonly I[],
  swaps: MealSwaps = {},
) {
  return mealIngredients(lines, swaps).map(({ line, optionIndex }, index) => ({
    index,
    line,
    optionIndex,
    item: items.find((item) =>
      line.id != null && item.ingredient_id === line.id,
    ) ?? null,
    atHome: probablyAtHome(line),
  }));
}

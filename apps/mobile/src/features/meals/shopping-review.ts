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

export type IngredientDecision = "undecided" | "shop" | "bought" | "home";

/** Shopping selection and ingredient choice are independent, joined by identity.
 * A shopping row decides an ingredient; otherwise the meal's at-home marks do. */
export function shoppingReview<L extends IngredientLine, I extends MealItem>(
  lines: readonly L[],
  items: readonly I[],
  swaps: MealSwaps = {},
  atHome: readonly number[] = [],
) {
  return mealIngredients(lines, swaps).map(({ line, optionIndex }, index) => {
    const item = items.find((item) =>
      line.id != null && item.ingredient_id === line.id,
    ) ?? null;
    const decision: IngredientDecision = item
      ? item.status === "purchased" ? "bought" : "shop"
      : line.id != null && atHome.includes(line.id) ? "home" : "undecided";
    return { index, line, optionIndex, item, decision, likelyHave: probablyAtHome(line) };
  });
}

/** Lines without an id cannot be decided, so they never hold a meal open. */
export function undecidedCount(review: ReturnType<typeof shoppingReview>) {
  return review.filter(
    (entry) => entry.decision === "undecided" && entry.line.id != null,
  ).length;
}

/** What a meal still needs, or what was decided once nothing is left. */
export function shoppingProgress(review: ReturnType<typeof shoppingReview>) {
  const undecided = undecidedCount(review);
  if (undecided) return `${undecided} to decide`;
  const count = (decision: IngredientDecision) =>
    review.filter((entry) => entry.decision === decision).length;
  const home = count("home");
  if (home === review.length) return "All at home";
  return [
    [count("shop"), "on the list"],
    [count("bought"), "bought"],
    [home, "at home"],
  ]
    .filter(([n]) => n)
    .map(([n, label]) => `${n} ${label}`)
    .join(" · ");
}

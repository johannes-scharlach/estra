import { itemNameKey, type IngredientLine, type MealItem } from "@estra/meals";

export function probablyAtHome(line: IngredientLine): boolean {
  return line.shopping_hint === "check_at_home";
}

export function ingredientSpec(line: IngredientLine): string | null {
  return (
    [line.qty_text?.trim(), line.prep_note].filter(Boolean).join(", ") || null
  );
}

export function optionsForLine(line: IngredientLine) {
  const seen = new Set<string>();
  return [line, ...(line.swaps ?? [])].filter((option) => {
    const key = itemNameKey(option.item_name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Match within this meal only. Reserve exact quantities/preparation first:
 * buying the second of two tomato lines must not cover the first on reopen.
 * Indistinguishable lines are treated as covered rather than bought again. */
export function shoppingReview<L extends IngredientLine, I extends MealItem>(
  lines: readonly L[],
  items: readonly I[],
) {
  const remaining = [...items];
  const review = lines.map((line, index) => ({
    index,
    line,
    item: null as I | null,
    optionIndex: 0,
    atHome: probablyAtHome(line),
  }));
  const matches = (line: L, item: I, exact: boolean, swaps = false) =>
    (swaps ? (line.swaps ?? []) : [line]).some(
      (option) =>
        item.name &&
        itemNameKey(option.item_name) === itemNameKey(item.name) &&
        (!exact || ingredientSpec(option) === item.spec),
    );

  // Recipe names win over optional swaps, regardless of line order. Bought
  // rice must cover the rice line before it can cover bulgur's rice swap.
  for (const exact of [true, false]) {
    for (const swaps of [false, true]) {
      for (const entry of review) {
        if (entry.item) continue;
        const index = remaining.findIndex((item) =>
          matches(entry.line, item, exact, swaps),
        );
        if (index >= 0) entry.item = remaining.splice(index, 1)[0]!;
      }
    }
    if (exact) {
      // Identical recipe lines have no persisted identity. Treat an exact
      // original-name match as covered rather than suggest buying it again.
      for (const entry of review) {
        entry.item ??=
          items.find((item) => matches(entry.line, item, true)) ?? null;
      }
    }
  }
  for (const entry of review) {
    if (!entry.item) continue;
    const options = optionsForLine(entry.line);
    const exactIndex = options.findIndex(
      (option) =>
        itemNameKey(option.item_name) === itemNameKey(entry.item!.name ?? "") &&
        ingredientSpec(option) === entry.item!.spec,
    );
    const nameIndex = options.findIndex(
      (option) =>
        itemNameKey(option.item_name) === itemNameKey(entry.item!.name ?? ""),
    );
    entry.optionIndex = exactIndex >= 0 ? exactIndex : Math.max(0, nameIndex);
  }
  return review;
}

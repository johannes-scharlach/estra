import type { IngredientLine } from "@estra/meals";

export { ingredientSpec } from "@estra/meals";

export type ShoppingItem = {
  id: string;
  name: string;
  spec: string | null;
  category_id: string | null;
  status: string;
  ingredient_id?: number | null;
};

/** Update already-chosen ingredients; a bought item remains a fact about a
 * purchase. New recipe ingredients need an explicit shopping choice. */
export function shoppingRevision(
  items: ShoppingItem[],
  lines: IngredientLine[],
) {
  const bought = items.filter((item) => item.status === "purchased");
  const remaining = items.filter((item) => item.status !== "purchased");
  const kept: { item: ShoppingItem; line: IngredientLine }[] = [];
  const removed: ShoppingItem[] = [];
  for (const item of remaining) {
    // Unlinked extras (including written-meal shopping) are not recipe ingredients.
    if (item.ingredient_id == null) continue;
    const line = lines.find((line) => line.id === item.ingredient_id);
    if (line) kept.push({ item, line });
    else removed.push(item);
  }
  return { bought, kept, removed };
}

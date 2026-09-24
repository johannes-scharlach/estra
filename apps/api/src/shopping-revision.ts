import { itemNameKey, type IngredientLine } from "@estra/meals";

export type ShoppingItem = {
  id: string;
  name: string;
  spec: string | null;
  category_id: string | null;
  status: string;
};

export function ingredientSpec(line: IngredientLine): string | null {
  return (
    [line.qty_text?.trim(), line.prep_note].filter(Boolean).join(", ") || null
  );
}

/** Update already-chosen ingredients; a bought item remains a fact about a
 * purchase. New recipe ingredients need an explicit shopping choice. */
export function shoppingRevision(
  items: ShoppingItem[],
  lines: IngredientLine[],
) {
  const bought = items.filter((item) => item.status === "purchased");
  const remaining = items.filter((item) => item.status !== "purchased");
  const availableBought = [...bought];
  const kept: { item: ShoppingItem; line: IngredientLine }[] = [];
  for (const line of lines) {
    const key = itemNameKey(line.item_name);
    const purchasedIndex = availableBought.findIndex(
      (item) => itemNameKey(item.name) === key,
    );
    if (purchasedIndex >= 0) {
      availableBought.splice(purchasedIndex, 1);
      continue;
    }
    const index = remaining.findIndex((item) => itemNameKey(item.name) === key);
    if (index >= 0) kept.push({ item: remaining.splice(index, 1)[0]!, line });
  }
  return { bought, kept, removed: remaining };
}

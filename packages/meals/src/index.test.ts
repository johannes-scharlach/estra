import { describe, expect, it } from "vitest";

import { lineForItem, mealIngredients, mealSync, type IngredientLine } from "./index";

const lines: IngredientLine[] = [
  {
    id: 1,
    qty_text: "2 tins",
    item_name: "Sardines in olive oil",
    swaps: [{ qty_text: "1 tin", item_name: "Canned tuna", prep_note: "drained" }],
  },
  { qty_text: "200g", item_name: "Bulgur", swaps: [{ qty_text: "200g", item_name: "Couscous" }] },
  { qty_text: "1", item_name: "Lemon" },
  { qty_text: null, item_name: "Black pepper" },
];

describe("lineForItem", () => {
  it("does not guess when two lines could own the item", () => {
    const doubled = [...lines, lines[0]!];
    expect(lineForItem("Canned tuna", doubled)).toBeNull();
  });
});

describe("mealSync", () => {
  const meal = { eater_ids: ["anna", "ben"], extra_portions: 1.5 };
  const noSwaps = mealIngredients(lines, {});
  const oneSwap = mealIngredients(lines, { 1: 1 });

  it("is in sync only when sized for the same eaters, in any order, with no swaps pending", () => {
    expect(mealSync({ eater_ids: ["ben", "anna"], extra_portions: 1.5 }, meal, noSwaps)).toEqual({
      sizing: "match",
      swaps: 0,
      inSync: true,
    });
    expect(mealSync({ eater_ids: ["ben", "anna"], extra_portions: 1.5 }, meal, oneSwap).inSync).toBe(false);
  });

  it("tells a recipe sized for other eaters from one never adjusted", () => {
    expect(mealSync({ eater_ids: ["anna"], extra_portions: 1.5 }, meal, noSwaps).sizing).toBe("differs");
    expect(mealSync({ eater_ids: ["anna", "ben"], extra_portions: 0 }, meal, noSwaps).sizing).toBe("differs");
    expect(mealSync(null, meal, noSwaps)).toEqual({ sizing: "unknown", swaps: 0, inSync: false });
  });
});

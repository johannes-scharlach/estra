import { describe, expect, it } from "vitest";

import { lineForItem, mealDelta, type IngredientLine } from "./index";

const lines: IngredientLine[] = [
  {
    qty_text: "2 tins",
    item_name: "Sardines in olive oil",
    swaps: [{ qty_text: "1 tin", item_name: "Canned tuna", prep_note: "drained" }],
  },
  { qty_text: "200g", item_name: "Bulgur", swaps: [{ qty_text: "200g", item_name: "Couscous" }] },
  { qty_text: "1", item_name: "Lemon" },
  { qty_text: null, item_name: "Black pepper" },
];

describe("mealDelta", () => {
  it("links each item to its line, sees swaps and bought items, and shows the rest", () => {
    const delta = mealDelta(lines, [
      { name: "canned tuna", spec: "1 tin, drained", status: "active" },
      { name: "Bulgur", spec: "200g", status: "purchased" },
      { name: "Meyer lemon", spec: null, status: "active" },
      // black pepper was removed from the list
    ]);
    expect(delta.lines.map((s) => [s.item?.name ?? null, s.swap?.item_name ?? null])).toEqual([
      ["canned tuna", "Canned tuna"],
      ["Bulgur", null],
      [null, null],
      [null, null],
    ]);
    expect(delta.lines[1]?.item?.status).toBe("purchased");
    expect(delta.extra.map((i) => i.name)).toEqual(["Meyer lemon"]);
    expect(delta.shopped).toBe(false);
  });

  it("is shopped only when every item is checked off and there is something to check", () => {
    expect(
      mealDelta(lines, [
        { name: "Bulgur", spec: null, status: "purchased" },
        { name: "Lemon", spec: null, status: "purchased" },
      ]).shopped,
    ).toBe(true);
    expect(mealDelta(lines, []).shopped).toBe(false);
  });

  it("does not guess when two lines could own the item", () => {
    const doubled = [...lines, lines[0]!];
    expect(lineForItem("Canned tuna", doubled)).toBeNull();
    const delta = mealDelta(doubled, [{ name: "Canned tuna", spec: null, status: "active" }]);
    expect(delta.extra).toHaveLength(1);
    expect(delta.lines.every((s) => s.item === null)).toBe(true);
  });
});

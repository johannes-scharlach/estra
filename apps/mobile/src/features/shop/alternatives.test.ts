import { describe, expect, it } from "vitest";

import { adjacentAlternative, alternativesForItem } from "./alternatives";

const raw = JSON.stringify([
  {
    item_name: "Fresh peppers",
    qty_text: "2",
    category_id: "produce",
    swaps: [
      {
        item_name: "Jarred peppers",
        qty_text: "150g",
        prep_note: "drained",
        category_id: "spices",
      },
      { item_name: "Frozen peppers", qty_text: "200g", category_id: "frozen" },
    ],
  },
]);

describe("shopping alternatives", () => {
  it("cycles in recipe order and reverses to the original with its quantity and category", () => {
    const options = alternativesForItem("Fresh peppers", raw);
    const next = adjacentAlternative("Fresh peppers", options, 1)!;
    expect(next).toEqual({
      name: "Jarred peppers",
      qtyText: "150g",
      prepNote: "drained",
      categoryId: "spices",
    });
    const afterSync = alternativesForItem(next.name, raw);
    expect(adjacentAlternative(next.name, afterSync, -1)).toEqual(options[0]);
    expect(adjacentAlternative(next.name, afterSync, 1)?.name).toBe(
      "Frozen peppers",
    );
    expect(adjacentAlternative("Frozen peppers", options, 1)).toEqual(
      options[0],
    );
  });

  it("does not invent a swap for a renamed, ambiguous or partially synced ingredient", () => {
    expect(alternativesForItem("Custom peppers", raw)).toEqual([]);
    expect(alternativesForItem("Fresh peppers", "{")).toEqual([]);
    const duplicate = JSON.stringify([...JSON.parse(raw), ...JSON.parse(raw)]);
    expect(alternativesForItem("Fresh peppers", duplicate)).toEqual([]);
    expect(adjacentAlternative("Fresh peppers", [], 1)).toBeNull();
  });
});

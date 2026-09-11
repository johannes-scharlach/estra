import { describe, expect, it } from "vitest";

import { holdPositions } from "./held-positions";

const row = (id: string, category: string | null) => ({
  id,
  category_id: category,
  category_name: category,
});

describe("held positions", () => {
  it("keeps a swapped row in its old spot with its old category", () => {
    // Sour cream was swapped for yogurt and now sorts under dairy.
    const sorted = [
      row("bread", "bakery"),
      row("cream", "dairy"),
      row("milk", "dairy"),
    ];
    const held = holdPositions(sorted, [
      {
        itemId: "cream",
        index: 0,
        categoryId: "fridge",
        categoryName: "Fridge",
      },
    ]);
    expect(held.map((item) => [item.id, item.category_name])).toEqual([
      ["cream", "Fridge"],
      ["bread", "bakery"],
      ["milk", "dairy"],
    ]);
  });

  it("does not split another category when the held index falls inside it", () => {
    const sorted = [
      row("a", "x"),
      row("b", "x"),
      row("c", "x"),
      row("held", "y"),
    ];
    const held = holdPositions(sorted, [
      { itemId: "held", index: 2, categoryId: "z", categoryName: "Z" },
    ]);
    expect(held.map((item) => item.id)).toEqual(["held", "a", "b", "c"]);
  });

  it("rejoins its own category when one already exists", () => {
    const sorted = [
      row("a", "x"),
      row("held", "y"),
      row("b", "z"),
      row("c", "z"),
    ];
    const held = holdPositions(sorted, [
      { itemId: "held", index: 0, categoryId: "z", categoryName: "Z" },
    ]);
    expect(held.map((item) => item.id)).toEqual(["a", "held", "b", "c"]);
  });
});

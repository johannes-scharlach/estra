import { expect, it } from "vitest";
import { IngredientLineSchema } from "../../db/schemas";
import { probablyAtHome, shoppingReview } from "./shopping-review";

it("uses the recipe's shopping hint, never the ingredient name or aisle", () => {
  const lines = [
    { item_name: "Salt", qty_text: "1 tsp", category_id: "spices" },
    {
      item_name: "Canned tomatoes",
      qty_text: "1 tin",
      category_id: "spices",
      shopping_hint: "likely_purchase",
    },
    {
      item_name: "Chiliflocken",
      qty_text: "1 tsp",
      category_id: "spices",
      shopping_hint: "check_at_home",
    },
    {
      item_name: "Garlic",
      qty_text: "1 clove",
      category_id: "produce",
      shopping_hint: "check_at_home",
    },
  ].map((line) => IngredientLineSchema.parse(line));
  expect(lines.filter(probablyAtHome)).toEqual(lines.slice(2));
  expect(shoppingReview(lines, []).map((entry) => entry.atHome)).toEqual([
    false,
    false,
    true,
    true,
  ]);
});

it("matches purchases by identity even after quantities change", () => {
  const bought = { ingredient_id: 2, name: "Tomato", spec: "2", status: "purchased" };
  const review = shoppingReview(
    [
      { id: 1, item_name: "Tomato", qty_text: "2" },
      { id: 2, item_name: "Tomato", qty_text: "4" },
    ],
    [bought],
  );
  expect(review.map((entry) => entry.item)).toEqual([null, bought]);
});

it("keeps identical ingredient lines distinct", () => {
  const bought = { ingredient_id: 1, name: "Tomato", spec: "1", status: "purchased" };
  const line = { id: 1, item_name: "Tomato", qty_text: "1" };
  expect(shoppingReview([line, { ...line, id: 2 }], [bought]).map((entry) => entry.item)).toEqual([bought, null]);
});

it("does not confuse another ingredient with an optional swap", () => {
  const rice = { id: 2, item_name: "Rice", qty_text: "200g" };
  const bought = { ingredient_id: 2, name: "Rice", spec: "200g", status: "purchased" };
  const review = shoppingReview(
    [{ id: 1, item_name: "Bulgur", qty_text: "200g", swaps: [rice] }, rice],
    [bought],
  );
  expect(review.map((entry) => entry.item)).toEqual([null, bought]);
});

it("recognises bought swaps and consumes an existing row only once for repeated recipe lines", () => {
  const bought = { ingredient_id: 1, name: "Orzo", spec: "200g", status: "purchased" };
  const tomato = { ingredient_id: 2, name: "Tomato", spec: "1", status: "active" };
  const review = shoppingReview(
    [
      {
        id: 1,
        item_name: "Bulgur",
        qty_text: "200g",
        swaps: [{ item_name: "Orzo", qty_text: "200g" }],
      },
      { id: 2, item_name: "Tomato", qty_text: "1" },
      { id: 3, item_name: "Tomato", qty_text: "2" },
    ],
    [bought, tomato],
  );
  expect(review.map((entry) => entry.item)).toEqual([bought, tomato, null]);
});

it("shows the meal choice even without a shopping item", () => {
  const review = shoppingReview(
    [
      {
        id: 8,
        item_name: "Bulgur",
        qty_text: "200g",
        swaps: [{ item_name: "Rice", qty_text: "200g" }],
      },
    ],
    [],
    { 8: 1 },
  );
  expect(review[0]).toMatchObject({ optionIndex: 1, item: null });
});

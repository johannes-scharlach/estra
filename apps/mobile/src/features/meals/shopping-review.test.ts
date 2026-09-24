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

it("reserves a bought row for the later recipe line with the matching quantity", () => {
  const bought = { name: "Tomato", spec: "2", status: "purchased" };
  const review = shoppingReview(
    [
      { item_name: "Tomato", qty_text: "1" },
      { item_name: "Tomato", qty_text: "2" },
    ],
    [bought],
  );
  expect(review.map((entry) => entry.item)).toEqual([null, bought]);
});

it("does not suggest rebuying an indistinguishable recipe line", () => {
  const bought = { name: "Tomato", spec: "1", status: "purchased" };
  const line = { item_name: "Tomato", qty_text: "1" };
  expect(
    shoppingReview([line, line], [bought]).every((entry) => entry.item),
  ).toBe(true);
});

it("matches an ingredient's own name before an earlier line's optional swap", () => {
  const rice = { item_name: "Rice", qty_text: "200g" };
  const bought = { name: "Rice", spec: "200g", status: "purchased" };
  const review = shoppingReview(
    [{ item_name: "Bulgur", qty_text: "200g", swaps: [rice] }, rice],
    [bought],
  );
  expect(review.map((entry) => entry.item)).toEqual([null, bought]);
});

it("recognises bought swaps and consumes an existing row only once for repeated recipe lines", () => {
  const bought = { name: "Orzo", spec: "200g", status: "purchased" };
  const tomato = { name: "Tomato", spec: "1", status: "active" };
  const review = shoppingReview(
    [
      {
        item_name: "Bulgur",
        qty_text: "200g",
        swaps: [{ item_name: "Orzo", qty_text: "200g" }],
      },
      { item_name: "Tomato", qty_text: "1" },
      { item_name: "Tomato", qty_text: "2" },
    ],
    [bought, tomato],
  );
  expect(review.map((entry) => entry.item)).toEqual([bought, tomato, null]);
});

it("shows an already-added swap as the selected option", () => {
  const review = shoppingReview(
    [
      {
        item_name: "Bulgur",
        qty_text: "200g",
        swaps: [{ item_name: "Rice", qty_text: "200g" }],
      },
    ],
    [{ name: "Rice", spec: "200g", status: "active" }],
  );
  expect(review[0]).toMatchObject({ optionIndex: 1, item: { name: "Rice" } });
});

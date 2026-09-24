import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ingredientSpec,
  shoppingRevision,
  type ShoppingItem,
} from "./shopping-revision.js";

const item = (id: string, name: string, status = "active"): ShoppingItem => ({
  id,
  name,
  status,
  spec: null,
  category_id: null,
});

test("a rewrite updates chosen ingredients without adding unchosen ones, preserving purchases and row identities", () => {
  const sardines = item("fish", "sardines", "purchased");
  const rice = item("grain", " Rice ");
  const result = shoppingRevision(
    [sardines, rice, item("herb", "parsley")],
    [
      { item_name: "tuna", qty_text: "2 tins" },
      { item_name: "rice", qty_text: "300g" },
    ],
  );
  assert.deepEqual(result.bought, [sardines]);
  assert.deepEqual(
    result.removed.map((row) => row.name),
    ["parsley"],
  );
  assert.equal(result.kept[0]?.item.id, rice.id);
  assert.equal(ingredientSpec(result.kept[0]!.line), "300g");
});

test("an exact bought ingredient is not added again or rewritten with new purchase facts", () => {
  const bought = { ...item("rice", "rice", "purchased"), spec: "200g" };
  const result = shoppingRevision(
    [bought],
    [{ item_name: "rice", qty_text: "400g" }],
  );
  assert.deepEqual(result.bought, [bought]);
  assert.deepEqual(result.kept, []);
  assert.deepEqual(result.removed, []);
});

test("rewriting a meal with no shopping choices leaves its shopping list empty", () => {
  assert.deepEqual(shoppingRevision([], [
    { item_name: "pasta", qty_text: "200g" },
    { item_name: "olive oil", qty_text: "1 tbsp" },
  ]), { bought: [], kept: [], removed: [] });
});

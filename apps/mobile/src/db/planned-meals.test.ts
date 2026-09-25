import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  clearPlannedMeal,
  movePlannedMeal,
  plannedMealId,
  repeatPlannedMeal,
  setPlannedMeal,
  setWrittenMeal,
  updatePlannedMealEaters,
} from "./planned-meals";
import { saveMealShoppingReview } from "./meal-shopping";
import { MEALS_WITH_SHOPPING } from "./shopping-meals";

const state = vi.hoisted(() => ({ db: null as DatabaseSync | null }));
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("./system", () => ({
  powersync: {
    writeTransaction: async (run: (tx: unknown) => Promise<void>) => {
      const db = state.db!;
      const tx = {
        execute: async (sql: string, args: SQLInputValue[] = []) =>
          db.prepare(sql).run(...args),
        getOptional: async (sql: string, args: SQLInputValue[] = []) =>
          db.prepare(sql).get(...args) ?? null,
        getAll: async (sql: string, args: SQLInputValue[] = []) =>
          db.prepare(sql).all(...args),
      };
      db.exec("BEGIN");
      try {
        await run(tx);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  },
}));

const listId = "household";
const date = "2026-09-23";
const source = {
  date,
  slot: "lunch" as const,
  variantId: null as string | null,
};
const destination = { date: "2026-09-24", slot: "dinner" as const };
const sourceId = plannedMealId(listId, date, source.slot);
const destinationId = plannedMealId(listId, destination.date, destination.slot);
const all = (table: string) =>
  state.db!.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
const shoppingMeal = (id: string) =>
  state.db!.prepare(`${MEALS_WITH_SHOPPING} WHERE pm.id = ?`).get(id);

beforeEach(() => {
  state.db = new DatabaseSync(":memory:");
  state.db.exec(`
    CREATE TABLE household_people (id TEXT, list_id TEXT, created_at TEXT);
    INSERT INTO household_people VALUES ('person', 'household', '2026-01-01');
    CREATE TABLE variants (id TEXT PRIMARY KEY, recipe_id TEXT, name TEXT, ingredient_lines TEXT, instructions TEXT, sized_for TEXT, created_at TEXT);
    CREATE TABLE planned_meals (
      id TEXT PRIMARY KEY, list_id TEXT, recipe_id TEXT, variant_id TEXT, name TEXT, content_id TEXT NOT NULL,
      slot_date TEXT, meal TEXT, eater_ids TEXT, extra_portions REAL, shopping_reviewed_variant_id TEXT, created_at TEXT, updated_at TEXT,
      CHECK ((recipe_id IS NOT NULL AND variant_id IS NOT NULL AND name IS NULL)
        OR (recipe_id IS NULL AND variant_id IS NULL AND length(trim(name)) > 0))
    );
    CREATE TABLE list_items (
      id TEXT PRIMARY KEY, list_id TEXT, name TEXT, name_key TEXT, category_id TEXT, spec TEXT,
      status TEXT, purchase_count INTEGER, planned_meal_id TEXT, variant_id TEXT, created_at TEXT, updated_at TEXT
    );
  `);
});
afterEach(() => state.db?.close());

async function writeMeal() {
  await setWrittenMeal({
    listId,
    slotDate: date,
    meal: source.slot,
    name: " Leftover lasagne ",
  });
}
function addSalad() {
  state
    .db!.prepare(
      `INSERT INTO list_items (id, list_id, name, name_key, status, purchase_count, planned_meal_id)
    VALUES ('salad', ?, 'Lettuce', 'lettuce', 'purchased', 1, ?)`,
    )
    .run(listId, sourceId);
}

it("stops prompting a written meal after adding an item, even when bought or moved", async () => {
  await writeMeal();
  expect(shoppingMeal(sourceId)).toMatchObject({ shopping_reviewed: 0 });
  // A standalone item is not a choice for this meal.
  state.db!.exec(
    "INSERT INTO list_items (id, list_id, name, status) VALUES ('milk', 'household', 'Milk', 'active')",
  );
  expect(shoppingMeal(sourceId)).toMatchObject({ shopping_reviewed: 0 });
  addSalad();
  state.db!.exec("UPDATE list_items SET status = 'active' WHERE id = 'salad'");
  expect(shoppingMeal(sourceId)).toMatchObject({ shopping_reviewed: 1 });
  state.db!.exec(
    "UPDATE list_items SET status = 'purchased' WHERE id = 'salad'",
  );
  expect(shoppingMeal(sourceId)).toMatchObject({ shopping_reviewed: 1 });
  await movePlannedMeal(listId, source, destination);
  expect(shoppingMeal(destinationId)).toMatchObject({ shopping_reviewed: 1 });
  await repeatPlannedMeal(listId, { ...destination, variantId: null }, source);
  expect(shoppingMeal(sourceId)).toMatchObject({ shopping_reviewed: 0 });
});

it("saves just a name, edits it without touching shopping, and supports eaters", async () => {
  await writeMeal();
  expect(all("planned_meals")[0]).toMatchObject({
    name: "Leftover lasagne",
    recipe_id: null,
    variant_id: null,
    eater_ids: '["person"]',
  });
  expect(all("variants")).toEqual([]);
  expect(all("list_items")).toEqual([]);
  addSalad();
  await setWrittenMeal({
    listId,
    slotDate: date,
    meal: source.slot,
    name: "Lasagne and salad",
    expectedName: "Leftover lasagne",
  });
  await updatePlannedMealEaters(listId, date, source.slot, null, [], 1);
  expect(all("planned_meals")[0]).toMatchObject({
    name: "Lasagne and salad",
    eater_ids: "[]",
    extra_portions: 1,
  });
  expect(all("list_items")[0]).toMatchObject({
    id: "salad",
    status: "purchased",
  });
  await expect(
    setWrittenMeal({
      listId,
      slotDate: date,
      meal: source.slot,
      name: "Bread",
    }),
  ).rejects.toThrow("already has a meal");
  await clearPlannedMeal(listId, date, source.slot);
  expect(all("list_items")).toEqual([]);
});

it("repeats the exact historical variant and leaves the original untouched", async () => {
  const insert = state.db!.prepare(
    "INSERT INTO variants (id, recipe_id, name, ingredient_lines, created_at) VALUES (?, 'recipe', ?, ?, ?)",
  );
  insert.run(
    "original",
    "Bulgur",
    JSON.stringify([{ item_name: "Bulgur", qty_text: "200g" }]),
    "2026-09-01",
  );
  insert.run(
    "latest",
    "Orzo",
    JSON.stringify([{ item_name: "Orzo", qty_text: "200g" }]),
    "2026-09-22",
  );
  await setPlannedMeal({
    listId,
    slotDate: date,
    meal: source.slot,
    recipeId: "recipe",
    variantId: "original",
    extraPortions: 2,
  });
  expect(all("list_items")).toEqual([]);
  await state
    .db!.prepare(
      "UPDATE planned_meals SET shopping_reviewed_variant_id = 'original' WHERE id = ?",
    )
    .run(sourceId);
  await setPlannedMeal({
    listId,
    slotDate: date,
    meal: source.slot,
    recipeId: "recipe",
    variantId: "original",
    extraPortions: 2,
  });
  expect(all("planned_meals")[0]).toMatchObject({
    shopping_reviewed_variant_id: null,
  });
  await saveMealShoppingReview({
    listId,
    mealId: sourceId,
    contentId: all("planned_meals")[0]!.content_id as string,
    variantId: "original",
    selections: [{ lineIndex: 0, optionIndex: 0 }],
  });
  state.db!.exec("UPDATE list_items SET status = 'purchased'");
  const original = all("planned_meals");
  await repeatPlannedMeal(
    listId,
    { ...source, variantId: "original" },
    destination,
  );
  expect(all("planned_meals").find((m) => m.id === sourceId)).toEqual(
    original[0],
  );
  expect(
    all("planned_meals").find((m) => m.id === destinationId),
  ).toMatchObject({ variant_id: "original", extra_portions: 2 });
  expect(
    all("planned_meals").find((m) => m.id === destinationId)?.content_id,
  ).not.toBe(original[0]?.content_id);
  expect(all("list_items")).toHaveLength(1);
  expect(all("list_items")[0]).toMatchObject({
    planned_meal_id: sourceId,
    name: "Bulgur",
    status: "purchased",
  });
  await expect(
    repeatPlannedMeal(
      listId,
      { ...source, variantId: "original" },
      destination,
    ),
  ).rejects.toThrow("already has a meal");
  expect(all("planned_meals")).toHaveLength(2);
});

it("moves written meals with purchased items, then swaps with another meal without losing either list", async () => {
  await writeMeal();
  addSalad();
  const identity = all("planned_meals")[0]?.content_id;
  await movePlannedMeal(listId, source, destination);
  expect(all("planned_meals")[0]).toMatchObject({
    id: destinationId,
    name: "Leftover lasagne",
    content_id: identity,
  });
  expect(all("list_items")[0]).toMatchObject({
    id: "salad",
    planned_meal_id: destinationId,
    status: "purchased",
  });
  await setWrittenMeal({
    listId,
    slotDate: date,
    meal: source.slot,
    name: "Bread and cheese",
  });
  await movePlannedMeal(listId, source, destination);
  expect(all("list_items")[0]).toMatchObject({
    id: "salad",
    planned_meal_id: sourceId,
    status: "purchased",
  });
  expect(all("planned_meals").find((m) => m.id === destinationId)?.name).toBe(
    "Bread and cheese",
  );
  expect(all("planned_meals").find((m) => m.id === sourceId)?.content_id).toBe(
    identity,
  );
});

it("repeats a written meal without shopping and rolls back an invalid recipe choice", async () => {
  await writeMeal();
  addSalad();
  await repeatPlannedMeal(listId, source, destination);
  expect(all("list_items")).toHaveLength(1);
  expect(all("list_items")[0]).toMatchObject({
    planned_meal_id: sourceId,
    name: "Lettuce",
    status: "purchased",
  });
  const before = all("planned_meals");
  await expect(
    setPlannedMeal({
      listId,
      slotDate: date,
      meal: source.slot,
      recipeId: "missing",
      variantId: "missing",
    }),
  ).rejects.toThrow();
  expect(all("planned_meals")).toEqual(before);
  expect(all("list_items").find((i) => i.id === "salad")?.status).toBe(
    "purchased",
  );
});

it("saves only chosen ingredients, preserves purchases on retry, and keeps the same ingredient separate across meals", async () => {
  state
    .db!.prepare(
      "INSERT INTO variants (id, recipe_id, name, ingredient_lines) VALUES ('recipe-v', 'recipe', 'Pasta', ?)",
    )
    .run(
      JSON.stringify([
        { item_name: "Pasta", qty_text: "200g", category_id: "grains" },
        { item_name: "Olive oil", qty_text: "1 tbsp" },
        { item_name: "Garlic powder", qty_text: "1 tsp" },
      ]),
    );
  await setPlannedMeal({
    listId,
    slotDate: date,
    meal: source.slot,
    recipeId: "recipe",
    variantId: "recipe-v",
  });
  expect(all("list_items")).toEqual([]);
  const selection = {
    listId,
    mealId: sourceId,
    contentId: all("planned_meals")[0]!.content_id as string,
    variantId: "recipe-v",
    selections: [
      { lineIndex: 0, optionIndex: 0 },
      { lineIndex: 2, optionIndex: 0 },
    ],
  };
  await saveMealShoppingReview(selection);
  expect(
    all("list_items")
      .map((i) => i.name)
      .sort(),
  ).toEqual(["Garlic powder", "Pasta"]);
  expect(all("list_items").find((i) => i.name === "Pasta")).toMatchObject({
    spec: "200g",
    category_id: "grains",
  });
  state.db!.exec(
    "UPDATE list_items SET status = 'purchased', purchase_count = 1",
  );
  const bought = all("list_items");
  await saveMealShoppingReview(selection);
  expect(all("list_items")).toEqual(bought);

  await repeatPlannedMeal(
    listId,
    { ...source, variantId: "recipe-v" },
    destination,
  );
  const nextMeal = all("planned_meals").find((m) => m.id === destinationId)!;
  await saveMealShoppingReview({
    ...selection,
    mealId: destinationId,
    contentId: nextMeal.content_id as string,
    selections: [{ lineIndex: 0, optionIndex: 0 }],
  });
  expect(all("list_items").filter((i) => i.name === "Pasta")).toHaveLength(2);
  expect(
    all("list_items").find((i) => i.planned_meal_id === destinationId),
  ).toMatchObject({ name: "Pasta", status: "active" });

  await expect(
    saveMealShoppingReview({
      ...selection,
      selections: [
        { lineIndex: 1, optionIndex: 0 },
        { lineIndex: 99, optionIndex: 0 },
      ],
    }),
  ).rejects.toThrow("changed");
  expect(all("list_items").some((i) => i.name === "Olive oil")).toBe(false);
  await setPlannedMeal({
    listId,
    slotDate: date,
    meal: source.slot,
    recipeId: "recipe",
    variantId: "recipe-v",
  });
  await expect(saveMealShoppingReview(selection)).rejects.toThrow("changed");
  expect(
    all("list_items").filter((i) => i.planned_meal_id === sourceId),
  ).toEqual([]);
});

it("retrying a later repeated ingredient preserves its purchased row", async () => {
  state
    .db!.prepare(
      "INSERT INTO variants (id, recipe_id, ingredient_lines) VALUES ('tomatoes', 'recipe', ?)",
    )
    .run(
      JSON.stringify([
        { item_name: "Tomato", qty_text: "1" },
        { item_name: "Tomato", qty_text: "2" },
      ]),
    );
  await setPlannedMeal({
    listId,
    slotDate: date,
    meal: source.slot,
    recipeId: "recipe",
    variantId: "tomatoes",
  });
  const selection = {
    listId,
    mealId: sourceId,
    contentId: all("planned_meals")[0]!.content_id as string,
    variantId: "tomatoes",
    selections: [{ lineIndex: 1, optionIndex: 0 }],
  };
  await saveMealShoppingReview(selection);
  state.db!.exec("UPDATE list_items SET status = 'purchased'");
  const bought = all("list_items");
  await saveMealShoppingReview(selection);
  expect(all("list_items")).toEqual(bought);
  expect(bought).toHaveLength(1);
  expect(bought[0]).toMatchObject({
    name: "Tomato",
    spec: "2",
    status: "purchased",
  });
});

it("saves swaps as the meal's shopping item and marks empty reviews complete", async () => {
  state
    .db!.prepare(
      "INSERT INTO variants (id, recipe_id, ingredient_lines) VALUES ('swap-v', 'recipe', ?)",
    )
    .run(
      JSON.stringify([
        {
          item_name: "Bulgur",
          qty_text: "200g",
          category_id: "grains",
          swaps: [
            { item_name: "Rice", qty_text: "200g", category_id: "grains" },
          ],
        },
        { item_name: "Olive oil", qty_text: "1 tbsp" },
      ]),
    );
  await setPlannedMeal({
    listId,
    slotDate: date,
    meal: source.slot,
    recipeId: "recipe",
    variantId: "swap-v",
  });
  const meal = all("planned_meals")[0]!;
  expect(shoppingMeal(sourceId)).toMatchObject({ shopping_reviewed: 0 });
  await saveMealShoppingReview({
    listId,
    mealId: sourceId,
    contentId: meal.content_id as string,
    variantId: "swap-v",
    selections: [{ lineIndex: 0, optionIndex: 1 }],
  });
  expect(all("planned_meals")[0]).toMatchObject({
    shopping_reviewed_variant_id: "swap-v",
  });
  expect(shoppingMeal(sourceId)).toMatchObject({ shopping_reviewed: 1 });
  expect(all("list_items")[0]).toMatchObject({
    name: "Rice",
    name_key: "rice",
    spec: "200g",
    variant_id: "swap-v",
  });
  const riceItemId = all("list_items")[0]!.id;
  await saveMealShoppingReview({
    listId,
    mealId: sourceId,
    contentId: meal.content_id as string,
    variantId: "swap-v",
    selections: [{ lineIndex: 0, optionIndex: 0 }],
  });
  expect(all("list_items")).toHaveLength(1);
  expect(all("list_items")[0]).toMatchObject({
    id: riceItemId,
    name: "Bulgur",
  });
  await saveMealShoppingReview({
    listId,
    mealId: sourceId,
    contentId: meal.content_id as string,
    variantId: "swap-v",
    selections: [],
  });
  expect(all("list_items")).toEqual([]);

  const nextDate = "2026-09-25";
  await setPlannedMeal({
    listId,
    slotDate: nextDate,
    meal: "dinner",
    recipeId: "recipe",
    variantId: "swap-v",
  });
  const nextId = plannedMealId(listId, nextDate, "dinner");
  const nextMeal = all("planned_meals").find((row) => row.id === nextId)!;
  await saveMealShoppingReview({
    listId,
    mealId: nextId,
    contentId: nextMeal.content_id as string,
    variantId: "swap-v",
    selections: [],
  });
  expect(all("planned_meals").find((row) => row.id === nextId)).toMatchObject({
    shopping_reviewed_variant_id: "swap-v",
  });
  expect(shoppingMeal(nextId)).toMatchObject({ shopping_reviewed: 1 });
  state.db!.exec(
    "UPDATE planned_meals SET shopping_reviewed_variant_id = 'older-variant'",
  );
  expect(shoppingMeal(nextId)).toMatchObject({ shopping_reviewed: 0 });
  expect(
    all("list_items").filter((item) => item.planned_meal_id === nextId),
  ).toEqual([]);
});

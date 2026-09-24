import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, type PoolClient } from "pg";

import { addMealShoppingItems } from "./meal-shopping.js";

// Runs against the already-running local stack when DATABASE_URL is supplied.
// All writes target connection-private temporary tables and are rolled back.
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
test("meal shopping is scoped, retry-safe, and preserves purchased items without creating a recipe", { skip: !local }, async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE planned_meals (id uuid PRIMARY KEY, list_id uuid, variant_id uuid, name text, content_id uuid NOT NULL DEFAULT gen_random_uuid());
      CREATE TEMP TABLE list_items (id uuid PRIMARY KEY, list_id uuid, name text, name_key text, spec text, category_id text, status text, planned_meal_id uuid REFERENCES planned_meals, variant_id uuid);
    `);
    const listId = "00000000-0000-4000-8000-000000000001";
    const mealId = "00000000-0000-4000-8000-000000000002";
    const meal = await client.query("INSERT INTO planned_meals (id, list_id, name) VALUES ($1, $2, 'Leftover lasagne with salad') RETURNING content_id", [mealId, listId]);
    const opts = { listId, plannedMealId: mealId, expectedContentId: meal.rows[0].content_id as string, items: [{ name: "Lettuce", spec: "1 head", categoryId: "produce" as const }] };
    const result = await addMealShoppingItems(client as PoolClient, opts);
    assert.deepEqual(result.added, ["Lettuce"]);
    await client.query("UPDATE list_items SET status = 'purchased'");
    const retry = await addMealShoppingItems(client as PoolClient, opts);
    assert.deepEqual(retry.added, []);
    assert.deepEqual(retry.alreadyOnList, ["Lettuce"]);
    const rows = await client.query("SELECT * FROM list_items");
    assert.equal(rows.rowCount, 1);
    assert.equal(rows.rows[0].status, "purchased");
    assert.equal(rows.rows[0].variant_id, null);
    assert.equal(rows.rows[0].planned_meal_id, mealId);
    assert.equal((await client.query("SELECT name FROM planned_meals")).rows[0].name, "Leftover lasagne with salad");
    await assert.rejects(addMealShoppingItems(client as PoolClient, { ...opts, listId: "00000000-0000-4000-8000-000000000003" }), /no longer planned/);

    // Move shopping to another slot, then fill the old slot with a new meal.
    const nextSlot = "00000000-0000-4000-8000-000000000004";
    await client.query("INSERT INTO planned_meals (id, list_id, name, content_id) SELECT $1, list_id, name, content_id FROM planned_meals WHERE id = $2", [nextSlot, mealId]);
    await client.query("UPDATE list_items SET planned_meal_id = $1", [nextSlot]);
    const replacement = await client.query("UPDATE planned_meals SET content_id = gen_random_uuid(), name = 'Bread and salad' WHERE id = $1 RETURNING content_id", [mealId]);
    await assert.rejects(addMealShoppingItems(client as PoolClient, opts), /moved or been replaced/);
    const newMeal = await addMealShoppingItems(client as PoolClient, { ...opts, expectedContentId: replacement.rows[0].content_id });
    assert.deepEqual(newMeal.added, ["Lettuce"]);
    const both = await client.query("SELECT planned_meal_id, status FROM list_items ORDER BY planned_meal_id");
    assert.deepEqual(both.rows, [
      { planned_meal_id: mealId, status: "active" },
      { planned_meal_id: nextSlot, status: "purchased" },
    ]);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});

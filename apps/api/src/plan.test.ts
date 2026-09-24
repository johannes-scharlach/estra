import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client, type PoolClient } from "pg";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

// Connection-private tables only; no changes to the household's real data.
test("server planning saves the meal without shopping and rejects occupied slots without losing chosen items", { skip: !local }, async () => {
  const { setPlannedMeal } = await import("./plan.js");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE household_people (id uuid, list_id uuid, name text, created_at timestamptz DEFAULT now());
      CREATE TEMP TABLE variants (id uuid, recipe_id uuid, name text, ingredient_lines jsonb);
      CREATE TEMP TABLE planned_meals (
        id uuid PRIMARY KEY, list_id uuid, recipe_id uuid, variant_id uuid, name text,
        content_id uuid DEFAULT gen_random_uuid(), slot_date text, meal text,
        eater_ids jsonb, extra_portions numeric, updated_at timestamptz DEFAULT now()
      );
      CREATE TEMP TABLE list_items (
        id uuid PRIMARY KEY, list_id uuid, name text, name_key text, category_id text, spec text,
        status text, purchase_count integer DEFAULT 0, planned_meal_id uuid, variant_id uuid
      );
    `);
    const listId = randomUUID();
    const variantId = randomUUID();
    await client.query("INSERT INTO variants VALUES ($1, $2, 'Pasta', $3)", [
      variantId, randomUUID(), JSON.stringify([{ item_name: "Pasta", qty_text: "200g" }, { item_name: "Olive oil", qty_text: "1 tbsp" }]),
    ]);
    const opts = { listId, variantId, slotDate: "2026-09-24", meal: "dinner" as const, ifOccupied: "reject" as const };
    const result = await setPlannedMeal(client as PoolClient, opts);
    assert.equal(result.name, "Pasta");
    assert.deepEqual(result.items, []);
    assert.equal((await client.query("SELECT * FROM planned_meals")).rowCount, 1);
    assert.equal((await client.query("SELECT * FROM list_items")).rowCount, 0);
    await client.query("INSERT INTO list_items (id, planned_meal_id, name, status) VALUES ($1, $2, 'Pasta', 'purchased')", [randomUUID(), result.plannedMealId]);
    await assert.rejects(setPlannedMeal(client as PoolClient, opts), /already has a meal/i);
    assert.equal((await client.query("SELECT status FROM list_items")).rows[0].status, "purchased");
    await setPlannedMeal(client as PoolClient, { ...opts, ifOccupied: "replace" });
    assert.equal((await client.query("SELECT * FROM list_items")).rowCount, 0);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});

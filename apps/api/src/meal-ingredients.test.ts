import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Client, type PoolClient } from "pg";

import { insertVariant } from "./variants.js";
import { repointMealVariant } from "./reconcile-meal-shopping.js";
import type { RecipeInput } from "./recipe-schema.js";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

// The real migration and persistence functions, isolated in connection-private
// tables. No production rows or schema are touched, even when the stack is live.
test("migration, identity allocation and adjustment preserve choices and purchase facts", { skip: !local }, async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE recipes (id uuid PRIMARY KEY);
      CREATE TEMP TABLE variants (
        id uuid PRIMARY KEY, recipe_id uuid, name text, description text, locale text,
        total_time text, recipe_yield text, content_markdown text, recipe_category text,
        recipe_cuisine text, ingredient_lines jsonb, instructions jsonb, sized_for jsonb,
        created_at timestamptz DEFAULT now()
      );
      CREATE TEMP TABLE planned_meals (id uuid PRIMARY KEY, variant_id uuid, shopping_reviewed_variant_id uuid, updated_at timestamptz);
      CREATE TEMP TABLE list_items (id uuid PRIMARY KEY, planned_meal_id uuid, variant_id uuid,
        name text, name_key text, spec text, category_id text, status text, created_at timestamptz DEFAULT now());
    `);
    const recipeId = "00000000-0000-4000-8000-000000000001";
    const baseId = "00000000-0000-4000-8000-000000000002";
    const mealId = "00000000-0000-4000-8000-000000000003";
    const adjustedId = "00000000-0000-4000-8000-000000000004";
    await client.query("INSERT INTO recipes VALUES ($1)", [recipeId]);
    await client.query("INSERT INTO variants (id, recipe_id, ingredient_lines) VALUES ($1, $2, $3::jsonb)", [baseId, recipeId, JSON.stringify([
      { item_name: "Sardines", qty_text: "3 tins", swaps: [{ item_name: "Tuna", qty_text: "2 tins" }] },
      { item_name: "Olives", qty_text: "60g" },
      { item_name: "Garlic", qty_text: "2 cloves" },
    ])]);
    await client.query("INSERT INTO planned_meals (id, variant_id) VALUES ($1, $2)", [mealId, baseId]);
    await client.query(`INSERT INTO list_items (id, planned_meal_id, variant_id, name, name_key, spec, status) VALUES
      ('00000000-0000-4000-8000-000000000010', $1, $2, 'Tuna', 'tuna', '2 tins', 'active'),
      ('00000000-0000-4000-8000-000000000011', $1, $2, 'Olives', 'olives', '60g', 'active'),
      ('00000000-0000-4000-8000-000000000012', $1, $2, 'Garlic', 'garlic', '2 cloves', 'purchased'),
      ('00000000-0000-4000-8000-000000000013', $1, $2, 'Napkins', 'napkins', NULL, 'active')`, [mealId, baseId]);
    const migration = await readFile(new URL("../../../supabase/migrations/20260929100000_meal_ingredient_choices.sql", import.meta.url), "utf8");
    await client.query(migration.replaceAll("public.", "pg_temp."));
    assert.deepEqual((await client.query("SELECT ingredient_swaps FROM planned_meals")).rows[0].ingredient_swaps, { 1: 1 });
    assert.deepEqual((await client.query("SELECT ingredient_id FROM list_items ORDER BY id")).rows.map((row) => row.ingredient_id), [1, 2, 3, null]);
    assert.equal((await client.query("SELECT next_ingredient_id FROM recipes")).rows[0].next_ingredient_id, 4);

    const recipe: RecipeInput = {
      name: "Tuna pasta", description: "Adjusted", locale: "en", totalTime: "20 minutes", recipeYield: "2 servings",
      recipeIngredient: [{ item_name: "Capers", qty_text: "20g" }, { id: 1, item_name: "Tuna", qty_text: "4 tins" }], recipeInstructions: [],
    };
    await insertVariant(client as PoolClient, { recipeId, variantId: adjustedId, baseVariantId: baseId, recipe });
    const lines = (await client.query("SELECT ingredient_lines FROM variants WHERE id = $1", [adjustedId])).rows[0].ingredient_lines;
    assert.deepEqual(lines.map((line: { id: number }) => line.id), [4, 1]);
    const result = await repointMealVariant(client as PoolClient, { mealId, variantId: adjustedId, expectedVariantId: baseId, expectedSwaps: { 1: 1 } });
    assert.deepEqual(result.removed, ["Olives"]);
    assert.deepEqual(result.added, []);
    const rows = (await client.query("SELECT name, spec, status, ingredient_id, variant_id FROM list_items ORDER BY id")).rows;
    assert.deepEqual(rows.map((row) => row.name), ["Tuna", "Garlic", "Napkins"]);
    assert.deepEqual(rows[1], { name: "Garlic", spec: "2 cloves", status: "purchased", ingredient_id: 3, variant_id: adjustedId });
    assert.deepEqual((await client.query("SELECT ingredient_swaps FROM planned_meals")).rows[0].ingredient_swaps, {});

    // Deleting the last allocated ingredient never makes its id available again.
    await insertVariant(client as PoolClient, { recipeId, variantId: "00000000-0000-4000-8000-000000000005", baseVariantId: adjustedId,
      recipe: { ...recipe, recipeIngredient: [{ id: 1, item_name: "Tuna", qty_text: "4 tins" }, { item_name: "Lemon", qty_text: "1" }] } });
    assert.equal((await client.query("SELECT next_ingredient_id FROM recipes")).rows[0].next_ingredient_id, 6);
    await assert.rejects(insertVariant(client as PoolClient, {
      recipeId, variantId: "00000000-0000-4000-8000-000000000006", baseVariantId: adjustedId,
      recipe: { ...recipe, recipeIngredient: [{ id: 3, item_name: "Lemon", qty_text: "1" }] },
    }), /Preserve unique ingredient ids/);
    assert.equal((await client.query("SELECT next_ingredient_id FROM recipes")).rows[0].next_ingredient_id, 6);
    await assert.rejects(repointMealVariant(client as PoolClient, { mealId, variantId: adjustedId, expectedVariantId: baseId }), /changed/i);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, type PoolClient } from "pg";

import { magpieUuidV5 } from "./magpie-uuid.js";

// The encoding apps/mobile/src/db/recipe-copies.ts must match (ADR 27).
const copiedVariantId = (listId: string, variantId: string) =>
  magpieUuidV5(JSON.stringify(["variant-copy", listId, variantId]));

// Runs against the already-running local stack when DATABASE_URL is supplied.
// Uses the real schema inside a transaction that is rolled back.
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

const anna = "a2700000-0000-4000-8000-000000000001";
const ben = "a2700000-0000-4000-8000-000000000002";
const annas = "b2700000-0000-4000-8000-000000000001";
const bens = "b2700000-0000-4000-8000-000000000002";
const cookies = "f2700000-0000-4000-8000-000000000002";

async function withHouseholds(work: (client: Client) => Promise<void>) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO auth.users (id) VALUES ('${anna}'), ('${ben}');
      INSERT INTO lists (id, name, created_by) VALUES
        ('${annas}', 'Anna', '${anna}'), ('${bens}', 'Ben', '${ben}');
      INSERT INTO household_profiles (id) VALUES ('${annas}'), ('${bens}');
      INSERT INTO list_members (list_id, user_id) VALUES ('${annas}', '${anna}'), ('${bens}', '${ben}');
      INSERT INTO recipes (id, list_id, from_url, created_by, origin) VALUES
        ('f2700000-0000-4000-8000-000000000001', '${annas}', 'https://example.com/cookies', '${anna}', 'import');
      INSERT INTO variants (id, recipe_id, list_id, name, ingredient_lines, sized_for) VALUES
        ('${cookies}', 'f2700000-0000-4000-8000-000000000001', '${annas}', 'Cookies',
         '[{"id": 4, "qty_text": "200g", "item_name": "butter"}]', '{"eater_ids": [], "extra_portions": 0}');
    `);
    await work(client);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}

async function as(client: Client, userId: string) {
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
  await client.query("SET LOCAL ROLE authenticated");
}

test("a shared link saves one copy into the friend's household, and nothing of Anna's is readable to them", { skip: !local }, async () => {
  await withHouseholds(async (client) => {
    await as(client, ben);
    assert.equal((await client.query("SELECT 1 FROM variants")).rowCount, 0);

    const saved = await client.query<{ id: string }>(
      "SELECT copy_variant_to_list($1, $2) AS id", [cookies, bens],
    );
    const again = await client.query<{ id: string }>(
      "SELECT copy_variant_to_list($1, $2) AS id", [cookies, bens],
    );
    assert.deepEqual(saved.rows, [{ id: copiedVariantId(bens, cookies) }]);
    assert.deepEqual(again.rows, saved.rows);

    const copy = await client.query(
      `SELECT v.name, v.ingredient_lines, v.sized_for, r.from_url, r.origin, r.created_by
       FROM variants v JOIN recipes r ON r.id = v.recipe_id`,
    );
    assert.deepEqual(copy.rows, [{
      name: "Cookies",
      ingredient_lines: [{ id: 4, qty_text: "200g", item_name: "butter" }],
      sized_for: null,
      from_url: "https://example.com/cookies",
      origin: null,
      created_by: null,
    }]);
  });
});

test("only members can save into a household", { skip: !local }, async () => {
  await withHouseholds(async (client) => {
    await as(client, ben);
    await assert.rejects(
      client.query("SELECT copy_variant_to_list($1, $2)", [cookies, annas]),
      /not a member/i,
    );
  });
});

test("planning a recipe from another of your households plans a copy there", { skip: !local }, async () => {
  const { setPlannedMeal } = await import("./plan.js");
  await withHouseholds(async (client) => {
    await client.query("INSERT INTO list_members (list_id, user_id) VALUES ($1, $2)", [bens, anna]);
    await as(client, anna);
    const slot = { listId: bens, slotDate: "2026-10-16", variantId: cookies, ifOccupied: "replace" as const };
    await setPlannedMeal(client as unknown as PoolClient, { ...slot, meal: "treat" });
    await setPlannedMeal(client as unknown as PoolClient, { ...slot, meal: "lunch" });

    const meals = await client.query(
      `SELECT pm.variant_id, v.list_id FROM planned_meals pm
       JOIN variants v ON v.id = pm.variant_id WHERE pm.list_id = $1`,
      [bens],
    );
    assert.deepEqual(meals.rows, [
      { variant_id: copiedVariantId(bens, cookies), list_id: bens },
      { variant_id: copiedVariantId(bens, cookies), list_id: bens },
    ]);
  });
});

test("a recipe on the plan can't be deleted", { skip: !local }, async () => {
  const { setPlannedMeal } = await import("./plan.js");
  await withHouseholds(async (client) => {
    await as(client, anna);
    await setPlannedMeal(client as unknown as PoolClient, {
      listId: annas, slotDate: "2026-10-16", meal: "treat", variantId: cookies, ifOccupied: "reject",
    });
    await assert.rejects(
      client.query("DELETE FROM recipes WHERE id = 'f2700000-0000-4000-8000-000000000001'"),
      /foreign key/i,
    );
  });
});

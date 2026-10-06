import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, type PoolClient } from "pg";

// Runs against the already-running local stack when DATABASE_URL is supplied.
// Uses the real schema and its triggers inside a transaction that is rolled back.
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
test("a meal planned through the API names the user as the actor", { skip: !local }, async () => {
  const { actAs } = await import("./db.js");
  const { setPlannedMeal } = await import("./plan.js");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO auth.users (id) VALUES
        ('a2000000-0000-4000-8000-000000000001'), ('a2000000-0000-4000-8000-000000000002');
      INSERT INTO lists (id, name, created_by) VALUES
        ('b2000000-0000-4000-8000-000000000001', 'Family', 'a2000000-0000-4000-8000-000000000001');
      INSERT INTO household_profiles (id) VALUES ('b2000000-0000-4000-8000-000000000001');
      INSERT INTO list_members (list_id, user_id) VALUES
        ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001'),
        ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002');
      INSERT INTO household_people (id, list_id, user_id, name, meal_times) VALUES
        ('c2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
         'a2000000-0000-4000-8000-000000000001', 'Anna', 'All meals');
      INSERT INTO recipes (id) VALUES ('f3000000-0000-4000-8000-000000000001');
      INSERT INTO variants (id, recipe_id, name) VALUES
        ('f4000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', 'Lasagne');
    `);

    await actAs(client as unknown as PoolClient, "a2000000-0000-4000-8000-000000000001");
    await setPlannedMeal(client as unknown as PoolClient, {
      listId: "b2000000-0000-4000-8000-000000000001",
      slotDate: "2026-10-08",
      meal: "dinner",
      variantId: "f4000000-0000-4000-8000-000000000001",
      ifOccupied: "replace",
    });

    const activities = await client.query(
      "SELECT kind, actor_name, meal_name FROM household_activities WHERE list_id = 'b2000000-0000-4000-8000-000000000001'",
    );
    assert.deepEqual(activities.rows, [{ kind: "meal_planned", actor_name: "Anna", meal_name: "Lasagne" }]);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});

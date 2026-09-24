import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local =
  url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

test(
  "written meal migration preserves recipe meals and enforces either a name or a recipe",
  { skip: !local },
  async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
      CREATE TEMP TABLE planned_meals (
        id text PRIMARY KEY, recipe_id text NOT NULL, variant_id text NOT NULL
      );
      INSERT INTO planned_meals VALUES ('existing', 'recipe', 'variant');
      CREATE TEMP TABLE chats (id text PRIMARY KEY);
    `);
      const migration = await readFile(
        new URL(
          "../../../supabase/migrations/20260923100000_written_meals.sql",
          import.meta.url,
        ),
        "utf8",
      );
      // Execute the actual migration against a connection-private table only.
      await client.query(
        migration
          .replaceAll("public.planned_meals", "pg_temp.planned_meals")
          .replaceAll("public.chats", "pg_temp.chats"),
      );
      assert.deepEqual(
        (
          await client.query(
            "SELECT id, recipe_id, variant_id, name FROM planned_meals WHERE id = 'existing'",
          )
        ).rows[0],
        {
          id: "existing",
          recipe_id: "recipe",
          variant_id: "variant",
          name: null,
        },
      );
      await client.query(
        "INSERT INTO planned_meals (id, name) VALUES ('written', 'Bread and cheese')",
      );
      for (const [recipe, variant, name] of [
        [null, null, null],
        [null, null, "  "],
        ["recipe", null, "Bread"],
        ["recipe", "variant", "Bread"],
      ]) {
        await client.query("SAVEPOINT invalid_meal");
        await assert.rejects(
          client.query(
            "INSERT INTO planned_meals (id, recipe_id, variant_id, name) VALUES ('invalid', $1, $2, $3)",
            [recipe, variant, name],
          ),
          { code: "23514" },
        );
        await client.query("ROLLBACK TO SAVEPOINT invalid_meal");
      }
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);

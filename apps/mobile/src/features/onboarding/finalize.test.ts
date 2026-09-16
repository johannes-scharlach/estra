import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { createDraft } from "./draft";
import { finalizeProfile, type ProfileWriter } from "./finalize";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(`
  CREATE TABLE lists (id TEXT PRIMARY KEY, name TEXT, invite_code TEXT, created_by TEXT, created_at TEXT, updated_at TEXT);
  CREATE TABLE list_members (id TEXT PRIMARY KEY, list_id TEXT, user_id TEXT, joined_at TEXT, UNIQUE(list_id, user_id));
  CREATE TABLE household_profiles (id TEXT PRIMARY KEY, goals TEXT, kitchen_equipment TEXT, pantry TEXT, fresh_ingredients TEXT, meals_at_home TEXT, main_supermarket TEXT, other_shops TEXT, created_at TEXT, updated_at TEXT);
  CREATE TABLE household_people (id TEXT PRIMARY KEY, list_id TEXT, user_id TEXT, name TEXT, age_group TEXT, diet TEXT, diet_other TEXT, restrictions TEXT, meal_times TEXT, created_at TEXT, updated_at TEXT, UNIQUE(list_id, user_id));
`);
const tx = {
  async execute(sql: string, parameters: unknown[] = []) {
    return sqlite.prepare(sql).run(...(parameters as SQLInputValue[]));
  },
  async getOptional<T>(
    sql: string,
    parameters: unknown[] = [],
  ): Promise<T | null> {
    return (
      (sqlite.prepare(sql).get(...(parameters as SQLInputValue[])) as T) ?? null
    );
  },
};
const db: ProfileWriter = {
  async writeTransaction(callback) {
    sqlite.exec("BEGIN");
    try {
      const result = await callback(tx);
      sqlite.exec("COMMIT");
      return result;
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  },
};
const userId = "0b7c6ad0-d77c-455a-8de4-8e2908881921";
function setup() {
  const draft = createDraft(
    "43ac36ba-b96c-4942-a188-f1192ce8ad3a",
    "d616b672-b51d-4ec9-bb16-d13672330ac9",
  );
  draft.user_id = userId;
  draft.people[0]!.name = "Sam";
  return draft;
}
afterEach(() =>
  sqlite.exec(
    "DROP TRIGGER IF EXISTS fail_person; DELETE FROM household_people; DELETE FROM household_profiles; DELETE FROM list_members; DELETE FROM lists;",
  ),
);

it("replays completion without duplicates or overwriting subsequent edits", async () => {
  const draft = setup();
  await finalizeProfile(db, draft, userId);
  await tx.execute(
    "UPDATE household_profiles SET meals_at_home = 'Weekend lunches only'",
  );
  await finalizeProfile(db, draft, userId);
  expect(await tx.getOptional("SELECT COUNT(*) AS count FROM lists")).toEqual({
    count: 1,
  });
  expect(
    await tx.getOptional("SELECT COUNT(*) AS count FROM list_members"),
  ).toEqual({ count: 1 });
  expect(
    await tx.getOptional("SELECT name, user_id FROM household_people"),
  ).toEqual({ name: "Sam", user_id: userId });
  expect(
    await tx.getOptional("SELECT meals_at_home FROM household_profiles"),
  ).toEqual({ meals_at_home: "Weekend lunches only" });
});

it("rolls back partial setup and can retry using the same verified identity", async () => {
  sqlite.exec(
    "CREATE TRIGGER fail_person BEFORE INSERT ON household_people BEGIN SELECT RAISE(ABORT, 'disk write failed'); END;",
  );
  const draft = setup();
  await expect(finalizeProfile(db, draft, userId)).rejects.toThrow(
    "disk write failed",
  );
  expect(await tx.getOptional("SELECT COUNT(*) AS count FROM lists")).toEqual({
    count: 0,
  });
  sqlite.exec("DROP TRIGGER fail_person");
  await finalizeProfile(db, draft, userId);
  expect(await tx.getOptional("SELECT id FROM household_profiles")).toEqual({
    id: draft.list_id,
  });
  await expect(finalizeProfile(db, draft, "another-user")).rejects.toThrow(
    "different account",
  );
});

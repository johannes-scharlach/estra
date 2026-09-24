import type { CookingProfile, HouseholdPerson } from "@estra/profile";
import { estraUuidV5 } from "../lib/estra-uuid";

type Executor = {
  execute(sql: string, parameters?: unknown[]): Promise<unknown>;
};

export async function insertPerson(
  tx: Executor,
  listId: string,
  person: HouseholdPerson,
  now: string,
): Promise<void> {
  await tx.execute(
    "INSERT INTO household_people (id, list_id, user_id, name, age_group, diet, diet_other, meal_times, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      person.id,
      listId,
      person.user_id,
      person.name,
      person.age_group,
      person.diet,
      person.diet_other,
      person.meal_times,
      now,
      now,
    ],
  );
}

/** A list with its creator as the first member. The member id is
 *  deterministic (uuidv5 of list:user) so a replay converges. */
export async function insertList(
  tx: Executor,
  list: {
    id: string;
    name: string;
    inviteCode: string;
    userId: string;
    now: string;
  },
): Promise<void> {
  await tx.execute(
    "INSERT INTO lists (id, name, invite_code, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [list.id, list.name, list.inviteCode, list.userId, list.now, list.now],
  );
  await tx.execute(
    "INSERT INTO list_members (id, list_id, user_id, joined_at) VALUES (?, ?, ?, ?)",
    [estraUuidV5(`${list.id}:${list.userId}`), list.id, list.userId, list.now],
  );
}

export async function insertProfile(
  tx: Executor,
  listId: string,
  p: CookingProfile,
  now: string,
): Promise<void> {
  await tx.execute(
    "INSERT INTO household_profiles (id, goals, kitchen_equipment, pantry, fresh_ingredients, restrictions, meals_at_home, main_supermarket, other_shops, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      listId,
      JSON.stringify(p.goals),
      JSON.stringify(p.kitchen_equipment),
      JSON.stringify(p.pantry),
      JSON.stringify(p.fresh_ingredients),
      p.restrictions,
      p.meals_at_home,
      p.main_supermarket,
      p.other_shops,
      now,
      now,
    ],
  );
}

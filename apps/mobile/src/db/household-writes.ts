import type { HouseholdPerson } from "@estra/profile";

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

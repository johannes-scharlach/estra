import {
  householdSchema,
  personSchema,
  profileSchema,
  type CookingProfile,
  type Household,
  type HouseholdPerson,
} from "@estra/profile";
import { powersync } from "./system";
import { insertPerson } from "./household-person-writes";

export function decodeHousehold(
  row: Record<string, unknown>,
  people: unknown[],
): Household {
  const profile = { ...row };
  for (const key of [
    "goals",
    "kitchen_equipment",
    "pantry",
    "fresh_ingredients",
  ]) {
    if (typeof profile[key] === "string")
      profile[key] = JSON.parse(profile[key]);
  }
  return householdSchema.parse({ profile, people });
}
export async function saveProfileSection(
  listId: string,
  changes: Partial<CookingProfile>,
): Promise<void> {
  const parsed = profileSchema.partial().parse(changes);
  const fields = Object.keys(parsed) as (keyof CookingProfile)[];
  if (!fields.length) return;
  await powersync.execute(
    `UPDATE household_profiles SET ${fields.map((key) => `${key} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
    [
      ...fields.map((key) =>
        typeof parsed[key] === "object"
          ? JSON.stringify(parsed[key])
          : parsed[key],
      ),
      new Date().toISOString(),
      listId,
    ],
  );
}
export async function savePerson(
  listId: string,
  value: HouseholdPerson,
): Promise<void> {
  const p = personSchema.parse(value);
  const now = new Date().toISOString();
  await powersync.writeTransaction(async (tx) => {
    const existing = await tx.getOptional<{ user_id: string | null }>(
      "SELECT user_id FROM household_people WHERE id = ? AND list_id = ?",
      [p.id, listId],
    );
    if (existing) {
      await tx.execute(
        "UPDATE household_people SET name = ?, age_group = ?, diet = ?, diet_other = ?, meal_times = ?, updated_at = ? WHERE id = ? AND list_id = ?",
        [
          p.name,
          p.age_group,
          p.diet,
          p.diet_other,
          p.meal_times,
          now,
          p.id,
          listId,
        ],
      );
    } else {
      await insertPerson(tx, listId, { ...p, user_id: null }, now);
    }
  });
}
export async function removePerson(
  listId: string,
  personId: string,
): Promise<void> {
  await powersync.writeTransaction(async (tx) => {
    const count = await tx.getOptional<{ total: number }>(
      "SELECT COUNT(*) AS total FROM household_people WHERE list_id = ?",
      [listId],
    );
    if ((count?.total ?? 0) <= 1)
      throw new Error("Keep at least one person in the household.");
    await tx.execute(
      "DELETE FROM household_people WHERE id = ? AND list_id = ?",
      [personId, listId],
    );
  });
}

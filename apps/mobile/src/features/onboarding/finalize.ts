import { householdSchema } from "@estra/profile";
import { estraUuidV5 } from "../../lib/estra-uuid";
import { insertPerson } from "../../db/household-person-writes";
import type { OnboardingDraft } from "./draft";

type Transaction = {
  execute(sql: string, parameters?: unknown[]): Promise<unknown>;
  getOptional<T>(sql: string, parameters?: unknown[]): Promise<T | null>;
};
export type ProfileWriter = {
  writeTransaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
};

/** The bound draft is durable before this operation starts. One local commit or none. */
export async function finalizeProfile(
  db: ProfileWriter,
  draft: OnboardingDraft,
  userId: string,
): Promise<void> {
  if (draft.user_id !== userId)
    throw new Error("This setup belongs to a different account.");
  const household = householdSchema.parse({
    profile: draft.profile,
    people: draft.people.map((p) => ({
      ...p,
      user_id: p.id === draft.onboarding_person_id ? userId : null,
    })),
  });
  const now = new Date().toISOString();
  await db.writeTransaction(async (tx) => {
    const existing = await tx.getOptional(
      "SELECT id FROM household_profiles WHERE id = ?",
      [draft.list_id],
    );
    if (existing) return;
    const list = await tx.getOptional("SELECT id FROM lists WHERE id = ?", [
      draft.list_id,
    ]);
    if (!list) {
      await tx.execute(
        "INSERT INTO lists (id, name, invite_code, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          draft.list_id,
          "Home",
          draft.list_id.replace(/-/g, "").slice(0, 12),
          userId,
          now,
          now,
        ],
      );
      await tx.execute(
        "INSERT INTO list_members (id, list_id, user_id, joined_at) VALUES (?, ?, ?, ?)",
        [estraUuidV5(`${draft.list_id}:${userId}`), draft.list_id, userId, now],
      );
    } else if (
      !(await tx.getOptional(
        "SELECT id FROM list_members WHERE list_id = ? AND user_id = ?",
        [draft.list_id, userId],
      ))
    ) {
      throw new Error("You no longer belong to this household.");
    }
    const p = household.profile;
    await tx.execute(
      "INSERT INTO household_profiles (id, goals, kitchen_equipment, pantry, fresh_ingredients, meals_at_home, main_supermarket, other_shops, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        draft.list_id,
        JSON.stringify(p.goals),
        JSON.stringify(p.kitchen_equipment),
        JSON.stringify(p.pantry),
        JSON.stringify(p.fresh_ingredients),
        p.meals_at_home,
        p.main_supermarket,
        p.other_shops,
        now,
        now,
      ],
    );
    for (const person of household.people) {
      await insertPerson(tx, draft.list_id, person, now);
    }
  });
}

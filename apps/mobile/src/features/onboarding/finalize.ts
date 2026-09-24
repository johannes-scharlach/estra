import { householdSchema } from "@estra/profile";
import {
  insertList,
  insertPerson,
  insertProfile,
} from "../../db/household-writes";
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
      await insertList(tx, {
        id: draft.list_id,
        name: "Home",
        inviteCode: draft.list_id.replace(/-/g, "").slice(0, 12),
        userId,
        now,
      });
    } else if (
      !(await tx.getOptional(
        "SELECT id FROM list_members WHERE list_id = ? AND user_id = ?",
        [draft.list_id, userId],
      ))
    ) {
      throw new Error("You no longer belong to this household.");
    }
    await insertProfile(tx, draft.list_id, household.profile, now);
    for (const person of household.people) {
      await insertPerson(tx, draft.list_id, person, now);
    }
  });
}

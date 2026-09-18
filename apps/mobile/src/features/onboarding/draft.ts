import {
  newPerson,
  newProfile,
  profileSchema,
  personSchema,
  type CookingProfile,
  type HouseholdPerson,
} from "@estra/profile";
import { z } from "zod";

export const steps = [
  "name",
  "goals",
  "diet",
  "household",
  "restrictions",
  "groceries",
  "kitchen",
  "pantry",
  "fresh",
  "email",
  "code",
] as const;
export type Step = (typeof steps)[number];
export type OnboardingDraft = {
  version: 1;
  onboarding_person_id: string;
  list_id: string;
  user_id: string | null;
  step: Step;
  email: string;
  profile: CookingProfile;
  people: HouseholdPerson[];
};
export function createDraft(personId: string, listId: string): OnboardingDraft {
  return {
    version: 1,
    onboarding_person_id: personId,
    list_id: listId,
    user_id: null,
    step: "name",
    email: "",
    profile: newProfile(),
    people: [newPerson(personId)],
  };
}

/** Bind once. A retry can never repurpose answers for another account or list. */
export function bindDraft(
  draft: OnboardingDraft,
  userId: string,
  existingListId: string | null,
): OnboardingDraft {
  if (draft.user_id && draft.user_id !== userId)
    throw new Error("This pending setup belongs to another account.");
  if (draft.user_id && existingListId && draft.list_id !== existingListId)
    throw new Error("This pending setup belongs to a different household.");
  return {
    ...draft,
    user_id: userId,
    list_id: draft.user_id ? draft.list_id : (existingListId ?? draft.list_id),
  };
}
const envelope = z.object({
  version: z.literal(1),
  onboarding_person_id: z.uuid(),
  list_id: z.uuid(),
  user_id: z.uuid().nullable(),
  step: z.enum(steps).catch("name"),
  email: z.string().catch(""),
  profile: z.record(z.string(), z.unknown()),
  people: z.array(z.unknown()),
});
// Incomplete names/custom diets are valid drafts, but not completed people.
const draftPerson = personSchema.shape;
const incompletePerson = z.object({ ...draftPerson, name: z.string() });

export function restoreDraft(raw: string | null): OnboardingDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = envelope.safeParse(parsed);
  if (!result.success) return null;
  const saved = result.data;
  const profile = newProfile();
  for (const key of Object.keys(
    profileSchema.shape,
  ) as (keyof CookingProfile)[]) {
    const value = profileSchema.shape[key].safeParse(saved.profile[key]);
    if (value.success) Object.assign(profile, { [key]: value.data });
  }
  const people = saved.people.flatMap((value) => {
    const person = incompletePerson.safeParse(value);
    return person.success ? [person.data] : [];
  });
  if (!people.some((p) => p.id === saved.onboarding_person_id)) {
    people.unshift(newPerson(saved.onboarding_person_id));
  }
  return { ...saved, profile, people };
}

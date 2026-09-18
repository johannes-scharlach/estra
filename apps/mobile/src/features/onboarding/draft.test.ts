import { describe, expect, it } from "vitest";
import { bindDraft, createDraft, restoreDraft } from "./draft";

const personId = "a17c9a92-784c-4dfe-b282-20bcfd877b11";
const listId = "e6169ef8-eb42-4fd3-ae4d-2932d9372381";

describe("onboarding draft recovery", () => {
  it("keeps answers and stable identities while recovering an invalid step and clearing OTP", () => {
    const draft = createDraft(personId, listId);
    draft.people[0]!.name = "Sam";
    draft.profile.meals_at_home =
      "Weekday dinners, weekend lunches and dinners";
    draft.profile.restrictions = "Peanut allergy";
    const restored = restoreDraft(
      JSON.stringify({ ...draft, step: "removed-screen", code: "123456" }),
    );
    expect(restored?.step).toBe("name");
    expect(restored?.people[0]?.name).toBe("Sam");
    expect(restored?.list_id).toBe(listId);
    expect(restored?.profile.meals_at_home).toBe(
      "Weekday dinners, weekend lunches and dinners",
    );
    expect(restored?.profile.restrictions).toBe("Peanut allergy");
    expect(restored).not.toHaveProperty("code");
  });
  it("never rebinds interrupted setup to another account or household", () => {
    const userId = "f689b399-d5be-4435-b89f-bfb37e4d510b";
    const draft = bindDraft(createDraft(personId, listId), userId, null);
    const restored = restoreDraft(JSON.stringify(draft))!;
    expect(bindDraft(restored, userId, listId).list_id).toBe(listId);
    expect(() =>
      bindDraft(restored, "b2a1c995-4ae6-400c-a6f1-1a4917c6d2df", listId),
    ).toThrow("another account");
    expect(() => bindDraft(restored, userId, "other-list")).toThrow(
      "different household",
    );
  });
  it("preserves explicit empty selections instead of reinstating defaults", () => {
    const draft = createDraft(personId, listId);
    draft.profile.pantry = { other: [] };
    draft.profile.kitchen_equipment = {
      oven: false,
      stove: false,
      other: ["Camping burner"],
    };
    const restored = restoreDraft(JSON.stringify(draft));
    expect(restored?.profile.pantry).toEqual({ other: [] });
    expect(restored?.profile.kitchen_equipment).toEqual({
      oven: false,
      stove: false,
      other: ["Camping burner"],
    });
  });
});

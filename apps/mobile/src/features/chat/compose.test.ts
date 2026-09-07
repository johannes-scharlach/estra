import { describe, expect, it } from "vitest";

import { entryMessage, mealPlanMessage, saveAndPlanMessage } from "./compose";
import { SLOT_LABEL, addDays, dateKey } from "@/features/meals/slots";

// Monday 2026-09-07, so Friday the 11th is four days out.
const TODAY = new Date(2026, 8, 7);

describe("entryMessage", () => {
  it("restates two chips plainly", () => {
    expect(entryMessage(["Broccoli", "Sausage"], 0)).toBe("I have broccoli and sausage.");
  });

  it("restates one chip", () => {
    expect(entryMessage(["Broccoli"], 0)).toBe("I have broccoli.");
  });

  it("joins three chips with and before the last", () => {
    expect(entryMessage(["Broccoli", "Sausage", "Rice"], 0)).toBe(
      "I have broccoli, sausage and rice.",
    );
  });

  it("appends the chips after the image message", () => {
    expect(entryMessage(["Broccoli", "Rice"], 2)).toBe("I also have broccoli and rice.");
  });

  it("refers to multiple attached images without describing their contents", () => {
    expect(entryMessage([], 2)).toBe("What's in these?");
  });
});

describe("mealPlanMessage", () => {
  it("asks for a draft of only the selected dates and meals", () => {
    expect(mealPlanMessage({
      slots: [
        { day: "2026-09-07", meal: "lunch" },
        { day: "2026-09-07", meal: "dinner" },
        { day: "2026-09-10", meal: "dinner" },
      ],
      notes: "",
      attachmentCount: 0,
    })).toBe("Help me draft a meal plan for these meals:\n- 2026-09-07: lunch\n- 2026-09-07: dinner\n- 2026-09-10: dinner");
  });

  it("preserves the user's notes without inventing preferences or image contents", () => {
    expect(mealPlanMessage({
      slots: [{ day: "2026-12-31", meal: "dinner" }, { day: "2027-01-01", meal: "lunch" }],
      notes: "  I'd like Thai food.\nNo oven on Friday.  ",
      attachmentCount: 2,
    })).toBe("Help me draft a meal plan for these meals:\n- 2026-12-31: dinner\n- 2027-01-01: lunch\nI'd like Thai food.\nNo oven on Friday.\nI've attached some images.");
  });

  it("omits blank notes and can attach one image without notes", () => {
    expect(mealPlanMessage({
      slots: [{ day: "2026-09-07", meal: "dinner" }],
      notes: " \n ",
      attachmentCount: 1,
    })).toBe("Help me draft a meal plan for these meals:\n- 2026-09-07: dinner\nI've attached an image.");
  });
});

describe("saveAndPlanMessage", () => {
  it("says the chosen day, meal, and servings", () => {
    expect(
      saveAndPlanMessage({ day: dateKey(new Date(2026, 8, 11)), meal: "dinner", servings: 2 }, TODAY),
    ).toBe("Save this and plan it for Friday dinner, 2 servings.");
  });

  it("names today and tomorrow as the strip labels them", () => {
    expect(
      saveAndPlanMessage({ day: dateKey(TODAY), meal: "dinner", servings: 2 }, TODAY),
    ).toBe("Save this and plan it for today dinner, 2 servings.");
    expect(
      saveAndPlanMessage({ day: dateKey(addDays(TODAY, 1)), meal: "lunch", servings: 1 }, TODAY),
    ).toBe(`Save this and plan it for tomorrow ${SLOT_LABEL.lunch.toLowerCase()}, 1 servings.`);
  });
});

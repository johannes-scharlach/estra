import { describe, expect, it } from "vitest";

import {
  adjustRecipeMessage,
  dishMessage,
  entryMessage,
  mealPlanMessage,
  saveAndPlanMessage,
} from "./compose";
import { toEaters } from "@/features/meals/eaters";
import { SLOT_LABEL, addDays, dateKey } from "@/features/meals/slots";

// Monday 2026-09-07, so Friday the 11th is four days out.
const TODAY = new Date(2026, 8, 7);

it("adjust names the exact date, selected eaters, extra and swaps without inventing a preference", () => {
  expect(
    adjustRecipeMessage({
      date: "2026-09-22",
      meal: "dinner",
      people: [
        { id: "me", name: "Johannes", self: true },
        { id: "a", name: "Anna", self: false },
      ],
      eaterIds: ["me"],
      extraPortions: 1.5,
      swaps: [{ from: "sardines", to: "tuna" }],
    }),
  ).toBe(
    "Write a variant for 2026-09-22 dinner.\nEating: me, plus 1.5 extra portions.\nUse tuna instead of sardines.\nSize the recipe for these eaters and fold the shopping list's swaps into the ingredients and steps.",
  );
});

describe("entryMessage", () => {
  it("restates two chips plainly", () => {
    expect(entryMessage(["Broccoli", "Sausage"], 0, "")).toBe(
      "I have broccoli and sausage.",
    );
  });

  it("restates one chip", () => {
    expect(entryMessage(["Broccoli"], 0, "")).toBe("I have broccoli.");
  });

  it("joins three chips with and before the last", () => {
    expect(entryMessage(["Broccoli", "Sausage", "Rice"], 0, "")).toBe(
      "I have broccoli, sausage and rice.",
    );
  });

  it("appends the chips after the image message", () => {
    expect(entryMessage(["Broccoli", "Rice"], 2, "")).toBe(
      "I also have broccoli and rice.",
    );
  });

  it("refers to multiple attached images without describing their contents", () => {
    expect(entryMessage([], 2, "")).toBe(
      "What could I make with what's in these photos?",
    );
    expect(entryMessage([], 1, "")).toBe(
      "What could I make with what's in this photo?",
    );
  });

  it("includes unfinished input without requiring a chip", () => {
    expect(entryMessage(["Broccoli"], 0, "  Rice  ")).toBe(
      "I have broccoli and rice.",
    );
    expect(entryMessage([], 0, "  Rice  ")).toBe("I have rice.");
    expect(entryMessage([], 1, "  Rice  ")).toBe("I also have rice.");
  });

  it("ignores whitespace left in the input", () => {
    expect(entryMessage(["Broccoli"], 0, "  ")).toBe("I have broccoli.");
  });
});

describe("dishMessage", () => {
  it("asks for directions using the user's own dish, not a full recipe", () => {
    expect(dishMessage("  Thai curry  ")).toBe(
      "Give me a few ideas for making: Thai curry",
    );
  });
});

describe("mealPlanMessage", () => {
  it("asks for a draft of only the selected dates and meals", () => {
    expect(
      mealPlanMessage({
        slots: [
          { day: "2026-09-07", meal: "lunch" },
          { day: "2026-09-07", meal: "dinner" },
          { day: "2026-09-10", meal: "dinner" },
        ],
        notes: "",
        attachmentCount: 0,
      }),
    ).toBe(
      "Help me draft a meal plan for these meals:\n- 2026-09-07: lunch\n- 2026-09-07: dinner\n- 2026-09-10: dinner",
    );
  });

  it("preserves the user's notes without inventing preferences or image contents", () => {
    expect(
      mealPlanMessage({
        slots: [
          { day: "2026-12-31", meal: "dinner" },
          { day: "2027-01-01", meal: "lunch" },
        ],
        notes: "  I'd like Thai food.\nNo oven on Friday.  ",
        attachmentCount: 2,
      }),
    ).toBe(
      "Help me draft a meal plan for these meals:\n- 2026-12-31: dinner\n- 2027-01-01: lunch\nI'd like Thai food.\nNo oven on Friday.\nI've attached some images.",
    );
  });

  it("omits blank notes and can attach one image without notes", () => {
    expect(
      mealPlanMessage({
        slots: [{ day: "2026-09-07", meal: "dinner" }],
        notes: " \n ",
        attachmentCount: 1,
      }),
    ).toBe(
      "Help me draft a meal plan for these meals:\n- 2026-09-07: dinner\nI've attached an image.",
    );
  });
});

describe("saveAndPlanMessage", () => {
  const people = toEaters(
    [
      { id: "a", name: "Johannes", user_id: "u1" },
      { id: "b", name: "Anna", user_id: null },
      { id: "c", name: "Ben", user_id: null },
    ],
    "u1",
  );
  const friday = dateKey(new Date(2026, 8, 11));

  it("says everyone when the whole household is ticked and no extra", () => {
    expect(
      saveAndPlanMessage(
        {
          day: friday,
          meal: "dinner",
          people,
          eaterIds: ["a", "b", "c"],
          extraPortions: 0,
        },
        TODAY,
      ),
    ).toBe("Save this and plan it for Friday dinner. Eating: everyone.");
  });

  it("names the ticked people in the user's voice, with fractional extra", () => {
    expect(
      saveAndPlanMessage(
        {
          day: friday,
          meal: "dinner",
          people,
          eaterIds: ["a", "c"],
          extraPortions: 1.5,
        },
        TODAY,
      ),
    ).toBe(
      "Save this and plan it for Friday dinner. Eating: me and Ben, plus 1.5 extra portions.",
    );
    expect(
      saveAndPlanMessage(
        {
          day: friday,
          meal: "dinner",
          people,
          eaterIds: ["b"],
          extraPortions: 1,
        },
        TODAY,
      ),
    ).toBe(
      "Save this and plan it for Friday dinner. Eating: Anna, plus 1 extra portion.",
    );
  });

  it("names today and tomorrow as the strip labels them", () => {
    expect(
      saveAndPlanMessage(
        {
          day: dateKey(TODAY),
          meal: "dinner",
          people,
          eaterIds: ["a", "b", "c"],
          extraPortions: 0,
        },
        TODAY,
      ),
    ).toBe("Save this and plan it for today dinner. Eating: everyone.");
    expect(
      saveAndPlanMessage(
        {
          day: dateKey(addDays(TODAY, 1)),
          meal: "lunch",
          people,
          eaterIds: ["a", "b", "c"],
          extraPortions: 0,
        },
        TODAY,
      ),
    ).toBe(
      `Save this and plan it for tomorrow ${SLOT_LABEL.lunch.toLowerCase()}. Eating: everyone.`,
    );
  });
});

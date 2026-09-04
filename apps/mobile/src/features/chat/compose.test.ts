import { describe, expect, it } from "vitest";

import { entryMessage, saveAndPlanMessage } from "./compose";
import { SLOT_LABEL, addDays, dateKey } from "@/features/meals/slots";

// Monday 2026-09-07, so Friday the 11th is four days out.
const TODAY = new Date(2026, 8, 7);

describe("entryMessage", () => {
  it("restates two chips plainly", () => {
    expect(entryMessage(["Broccoli", "Sausage"], false)).toBe("I have broccoli and sausage.");
  });

  it("restates one chip", () => {
    expect(entryMessage(["Broccoli"], false)).toBe("I have broccoli.");
  });

  it("joins three chips with and before the last", () => {
    expect(entryMessage(["Broccoli", "Sausage", "Rice"], false)).toBe(
      "I have broccoli, sausage and rice.",
    );
  });

  it("appends the chips after the photo message", () => {
    expect(entryMessage(["Broccoli", "Rice"], true)).toBe("I also have broccoli and rice.");
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

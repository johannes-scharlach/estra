import { describe, expect, it } from "vitest";

import { mealActivityText, type MealActivity } from "./meal-activity-text";

// Wednesday.
const today = "2026-10-07";
const planned: MealActivity = {
  kind: "meal_planned",
  actor_name: "Anna",
  meal_name: "Lasagne",
  slot_date: "2026-10-08",
  meal: "dinner",
  previous_meal_name: null,
  previous_slot_date: null,
  previous_meal: null,
};

describe("meal activity text", () => {
  it("leads with the slot, then the meal, then who", () => {
    expect(mealActivityText(planned, today)).toEqual({
      title: "Tomorrow's dinner",
      body: "Lasagne · Anna",
    });
  });

  it("names today and tomorrow, and later days by weekday", () => {
    expect(
      mealActivityText({ ...planned, slot_date: today, meal: "lunch" }, today)
        .title,
    ).toBe("Today's lunch");
    expect(
      mealActivityText({ ...planned, slot_date: "2026-10-09" }, today).title,
    ).toBe("Friday's dinner");
  });

  it("says what is there now, then where it came from", () => {
    const body = (change: Partial<MealActivity>) =>
      mealActivityText({ ...planned, ...change }, today).body;
    expect(
      body({
        kind: "meal_changed",
        meal_name: "Vegan lasagne",
        previous_meal_name: "Lasagne",
      }),
    ).toBe("Vegan lasagne, was Lasagne · Anna");
    expect(body({ kind: "meal_changed", previous_meal_name: "Lasagne" })).toBe(
      "Lasagne, recipe changed · Anna",
    );
    expect(
      body({
        kind: "meal_replaced",
        meal_name: "Pasta",
        previous_meal_name: "Lasagne",
      }),
    ).toBe("Pasta, instead of Lasagne · Anna");
    expect(body({ kind: "meal_removed" })).toBe("Lasagne removed · Anna");
  });

  it("names only the part of the origin that differs", () => {
    const moved = (
      previous_slot_date: string,
      previous_meal: string,
      meal = "dinner",
    ) =>
      mealActivityText(
        {
          ...planned,
          kind: "meal_moved",
          meal,
          previous_slot_date,
          previous_meal,
        },
        today,
      ).body;
    expect(moved(today, "dinner")).toBe("Lasagne, moved from today · Anna");
    expect(moved(today, "dinner", "lunch")).toBe(
      "Lasagne, moved from today's dinner · Anna",
    );
    expect(moved("2026-10-08", "lunch")).toBe(
      "Lasagne, moved from lunch · Anna",
    );
  });
});

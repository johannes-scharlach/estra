import { describe, expect, it } from "vitest";

import { mealLabel, shoppedLabel, variantMeals } from "./variant-meals";

const v1 = "variant-1";
const v2 = "variant-2";
const meals = [
  { id: "past", variant_id: v1, slot_date: "2026-09-10", meal: "dinner" },
  { id: "fri", variant_id: v1, slot_date: "2026-09-25", meal: "dinner" },
  { id: "sat-v2", variant_id: v2, slot_date: "2026-09-26", meal: "lunch" },
  { id: "mon", variant_id: v1, slot_date: "2026-09-21", meal: "treat" },
  { id: "mon-lunch", variant_id: v1, slot_date: "2026-09-21", meal: "lunch" },
];
const today = "2026-09-18";

describe("variantMeals", () => {
  it("prefers the meal the card opened, else the nearest upcoming one on this variant", () => {
    expect(variantMeals(meals, { variantId: v1, plannedMealId: "fri", today }).selected?.id).toBe("fri");
    expect(variantMeals(meals, { variantId: v1, today }).selected?.id).toBe("mon-lunch");
  });

  it("names a sibling version's upcoming meal and the last past meal only when idle", () => {
    const planned = variantMeals(meals, { variantId: v1, today });
    expect(planned.sibling?.id).toBe("sat-v2");
    expect(planned.lastPast).toBeNull();
    const idle = variantMeals(meals, { variantId: "variant-3", today });
    expect(idle.selected).toBeNull();
    expect(idle.sibling?.id).toBe("mon-lunch");
    expect(idle.lastPast?.id).toBe("past");
  });
});

describe("labels", () => {
  it("say the day the way the chat message does and count the shopping", () => {
    const on = new Date(2026, 8, 18);
    expect(mealLabel({ id: "x", variant_id: v1, slot_date: "2026-09-18", meal: "dinner" }, on)).toBe("Today · Dinner");
    expect(mealLabel({ id: "x", variant_id: v1, slot_date: "2026-09-21", meal: "lunch" }, on)).toBe("Monday · Lunch");
    expect(shoppedLabel([])).toBe("Nothing to buy");
    expect(shoppedLabel([{ status: "purchased" }, { status: "active" }])).toBe("1 of 2 shopped");
    expect(shoppedLabel([{ status: "purchased" }])).toBe("Shopped");
  });
});

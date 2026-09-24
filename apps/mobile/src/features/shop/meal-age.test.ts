import { expect, it } from "vitest";
import { mealAge } from "./meal-age";

it("marks past meals, never today's meals, future meals, or standalone items", () => {
  expect(mealAge("2026-09-22", "2026-09-24")).toBe("2 days ago");
  expect(mealAge("2026-09-23", "2026-09-24")).toBe("1 day ago");
  expect(mealAge("2026-09-24", "2026-09-24")).toBeNull();
  expect(mealAge("2026-09-29", "2026-09-24")).toBeNull();
  expect(mealAge(null, "2026-09-24")).toBeNull();
});

it("counts calendar days across year and daylight-saving boundaries", () => {
  expect(mealAge("2025-12-31", "2026-01-01")).toBe("1 day ago");
  expect(mealAge("2026-03-28", "2026-03-30")).toBe("2 days ago");
  expect(mealAge("2026-10-24", "2026-10-26")).toBe("2 days ago");
});

import { describe, expect, it } from "vitest";

import { notificationRoute } from "./notification-route";

describe("notification route", () => {
  it("opens Meals on the meal's day", () => {
    expect(
      notificationRoute({ kind: "meal_moved", slotDate: "2026-10-08" }, "n1"),
    ).toEqual({
      pathname: "/(tabs)/meals",
      params: { date: "2026-10-08", at: "n1" },
    });
  });

  it("opens Household activity for joins and pushes from older servers", () => {
    expect(notificationRoute({ kind: "member_joined" }, "n1")).toBe(
      "/household-activity",
    );
    expect(notificationRoute({}, "n1")).toBe("/household-activity");
  });
});

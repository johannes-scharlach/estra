import { describe, expect, it } from "vitest";

import { ActivityVisit, visibleActivityIds } from "./activity-visit";

const activities = [
  { id: "alex", seen_at: null },
  { id: "sam", seen_at: null },
];

describe("an activity visit", () => {
  it("counts half a row inside the unobscured viewport, not behind native bars", () => {
    expect(visibleActivityIds([
      { id: "behind-header", top: 80, height: 30 },
      { id: "half-visible", top: 85, height: 30 },
      { id: "middle", top: 400, height: 50 },
      { id: "behind-tabs", top: 585, height: 40 },
      { id: "not-laid-out", top: 400, height: 0 },
    ], { top: 100, bottom: 600 })).toEqual(["half-visible", "middle"]);
  });
  it("marks only exposed activities after one continuous second", () => {
    const visit = new ActivityVisit();
    const screen = { activities, visibleIds: ["alex"], active: true };

    expect(visit.update(screen, 0).seenIds).toEqual([]);
    expect(visit.update(screen, 999).seenIds).toEqual([]);
    expect(visit.update(screen, 1000).seenIds).toEqual(["alex"]);
  });

  it("starts over after scrolling away or losing foreground focus", () => {
    for (const interruption of [
      { visibleIds: [], active: true },
      { visibleIds: ["alex"], active: false },
    ]) {
      const visit = new ActivityVisit();
      const screen = { activities, visibleIds: ["alex"], active: true };
      visit.update(screen, 0);
      expect(visit.update({ activities, ...interruption }, 800).seenIds).toEqual([]);
      expect(visit.update(screen, 2000).seenIds).toEqual([]);
      expect(visit.update(screen, 2999).seenIds).toEqual([]);
      expect(visit.update(screen, 3000).seenIds).toEqual(["alex"]);
    }
  });

  it("keeps new styling after seen syncs, until the next visit", () => {
    const visit = new ActivityVisit();
    const screen = { activities, visibleIds: ["alex"], active: true };
    expect(visit.update(screen, 0).newIds).toEqual(new Set(["alex", "sam"]));
    const synced = {
      ...screen,
      activities: [{ id: "alex", seen_at: "2026-09-29T10:00:00Z" }, activities[1]!],
    };
    const current = visit.update(synced, 1000);
    expect(current.seenIds).toEqual([]);
    expect(current.newIds).toEqual(new Set(["alex", "sam"]));

    // A keyboard or notification shade hides rows without leaving the visit.
    expect(visit.update({ ...synced, visibleIds: [] }, 1050).newIds)
      .toEqual(new Set(["alex", "sam"]));

    visit.update({ ...synced, active: false }, 1100);
    expect(visit.update(synced, 2000).newIds).toEqual(new Set(["sam"]));
  });
});

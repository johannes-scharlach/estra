type Activity = { id: string; seen_at: string | null };
export type ActivityCellLayout = { id: string; top: number; height: number };

/** Coordinates share one space; the viewport excludes navigation and tab bars. */
export function visibleActivityIds(
  cells: readonly ActivityCellLayout[],
  viewport: { top: number; bottom: number },
): string[] {
  return cells.filter((cell) => {
    const visible = Math.min(cell.top + cell.height, viewport.bottom) - Math.max(cell.top, viewport.top);
    return cell.height > 0 && visible >= cell.height / 2;
  }).map((cell) => cell.id);
}

type Screen = {
  activities: readonly Activity[];
  /** Rows at least half visible in the unobscured viewport. */
  visibleIds: readonly string[];
  active: boolean;
};

/** A visit owns exposure timing. Mounting/downloading an activity isn't seeing it. */
export class ActivityVisit {
  private exposedSince = new Map<string, number>();
  private initiallyNew = new Map<string, boolean>();

  update(screen: Screen, now: number) {
    const seenIds: string[] = [];
    const newIds = new Set<string>();
    const exposed = new Map<string, number>();
    if (!screen.active) this.initiallyNew.clear();
    for (const activity of screen.activities) {
      if (!screen.active) continue;
      if (!this.initiallyNew.has(activity.id)) {
        this.initiallyNew.set(activity.id, activity.seen_at === null);
      }
      if (this.initiallyNew.get(activity.id)) newIds.add(activity.id);
      if (activity.seen_at || !screen.visibleIds.includes(activity.id)) continue;
      const since = this.exposedSince.get(activity.id) ?? now;
      exposed.set(activity.id, since);
      if (now - since >= 1000) seenIds.push(activity.id);
    }
    this.exposedSince = exposed;
    // Unpersisted IDs remain eligible: a failed local write can be retried.
    return { seenIds, newIds };
  }
}

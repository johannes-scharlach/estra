/**
 * Hardcoded demo data for the meals overview. There is no meals schema yet
 * (see docs/schema-changes.md before designing one) — everything here is
 * anchored to the real "today" so the screen always makes sense.
 */

export type Recipe = { id: string; name: string };

export type MealSlot = "lunch" | "dinner" | "treat";

/**
 * Slot value semantics:
 *   Recipe    — planned
 *   null      — open, show contenders
 *   "skipped" — hidden behind "+ Add …" (lunch/dinner; treat uses undefined)
 *   undefined — never touched (lunch/dinner behave as open, treat as hidden)
 */
export type SlotValue = Recipe | null | "skipped";
export type DayMeals = Partial<Record<MealSlot, SlotValue>>;

export const SLOT_ORDER: MealSlot[] = ["lunch", "dinner", "treat"];
export const SLOT_LABEL: Record<MealSlot, string> = {
  lunch: "Lunch",
  dinner: "Dinner",
  treat: "Treat",
};

/** Resolved display state for a slot: planned recipe, open (null), or hidden. */
export function slotState(day: DayMeals, slot: MealSlot): Recipe | null | "hidden" {
  const v = day[slot];
  if (v === undefined) return slot === "treat" ? "hidden" : null;
  return v === "skipped" ? "hidden" : v;
}

const r = (id: string, name: string): Recipe => ({ id, name });

export const CONTENDERS: Record<MealSlot, Recipe[]> = {
  lunch: [
    r("c-l1", "Caesar salad"),
    r("c-l2", "Grilled cheese"),
    r("c-l3", "Tomato soup"),
    r("c-l4", "Ramen"),
    r("c-l5", "Pasta al limone"),
  ],
  dinner: [
    r("c-d1", "Chicken traybake"),
    r("c-d2", "Veggie curry"),
    r("c-d3", "Fish tacos"),
    r("c-d4", "Sheet-pan salmon"),
    r("c-d5", "Mushroom risotto"),
  ],
  treat: [r("c-t1", "Brownies"), r("c-t2", "Fruit salad"), r("c-t3", "Pancakes")],
};

export const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Local-date key, yyyy-mm-dd. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export const PAST_DAYS = 14;
export const FUTURE_DAYS = 3;

/** Strip runs 14 days back through 3 days ahead — as far as the plan reaches. */
export function stripDates(): { dates: Date[]; todayIndex: number } {
  const today = new Date();
  const dates = Array.from({ length: PAST_DAYS + 1 + FUTURE_DAYS }, (_, i) =>
    addDays(today, i - PAST_DAYS),
  );
  return { dates, todayIndex: PAST_DAYS };
}

export function demoPlans(): Record<string, DayMeals> {
  const key = (offset: number) => dateKey(addDays(new Date(), offset));
  return {
    [key(-2)]: { dinner: r("p-1", "Pasta al limone") },
    [key(-1)]: { lunch: r("p-2", "Grilled cheese"), dinner: r("p-3", "Ramen") },
    [key(0)]: { lunch: r("p-4", "Tomato soup"), dinner: r("p-5", "Chicken traybake") },
    [key(1)]: { dinner: r("p-6", "Veggie curry") },
    [key(3)]: { dinner: r("p-7", "Sheet-pan salmon") },
  };
}

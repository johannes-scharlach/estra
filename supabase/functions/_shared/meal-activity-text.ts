// Twin of apps/mobile/src/features/activity/meal-activity-text.ts (spec 0008).
// Keep the two in step; both test files cover the same cases.

export type MealActivity = {
  kind:
    | "meal_planned"
    | "meal_changed"
    | "meal_replaced"
    | "meal_moved"
    | "meal_removed";
  actor_name: string;
  meal_name: string;
  slot_date: string;
  meal: string;
  previous_meal_name: string | null;
  previous_slot_date: string | null;
  previous_meal: string | null;
};

const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Slot first, then the meal, then who: "Tomorrow's dinner" / "Lasagne · Anna".
 * Without `today` (the recipient's time zone is unknown) every day is named
 * by weekday, which follows from the date alone.
 */
export function mealActivityText(activity: MealActivity, today: string | null) {
  return {
    title: `${dayName(activity.slot_date, today)}'s ${activity.meal}`,
    body: `${whatChanged(activity, today)} · ${activity.actor_name}`,
  };
}

/** The date in `timeZone` as YYYY-MM-DD, or null for a missing or unknown zone. */
export function todayIn(timeZone: string | null, now: Date): string | null {
  if (!timeZone) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  } catch {
    return null;
  }
}

function whatChanged(a: MealActivity, today: string | null): string {
  switch (a.kind) {
    case "meal_planned":
      return a.meal_name;
    case "meal_changed":
      return a.previous_meal_name === a.meal_name
        ? `${a.meal_name}, recipe changed`
        : `${a.meal_name}, was ${a.previous_meal_name}`;
    case "meal_replaced":
      return `${a.meal_name}, instead of ${a.previous_meal_name}`;
    case "meal_moved":
      return `${a.meal_name}, moved from ${origin(a, today)}`;
    case "meal_removed":
      return `${a.meal_name} removed`;
  }
}

/** Only the part of the previous slot that differs: "today", "lunch", "today's dinner". */
function origin(a: MealActivity, today: string | null): string {
  const day = inSentence(dayName(a.previous_slot_date!, today));
  if (a.previous_slot_date === a.slot_date) return a.previous_meal!;
  if (a.previous_meal === a.meal) return day;
  return `${day}'s ${a.previous_meal}`;
}

const inSentence = (day: string) =>
  day === "Today" || day === "Tomorrow" ? day.toLowerCase() : day;

// Read as UTC so the server's own zone never shifts the day.
function dayName(date: string, today: string | null): string {
  if (date === today) return "Today";
  if (today && date === addDay(today)) return "Tomorrow";
  return WEEKDAY_LONG[new Date(`${date}T00:00Z`).getUTCDay()]!;
}

function addDay(date: string): string {
  const next = new Date(`${date}T00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

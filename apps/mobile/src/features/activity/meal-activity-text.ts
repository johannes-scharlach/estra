import {
  addDays,
  dateKey,
  SLOT_LABEL,
  WEEKDAY_LONG,
  type MealSlot,
} from "@/features/meals/slots";

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

/** Slot first, then the meal, then who: "Tomorrow's dinner" / "Lasagne · Anna". */
export function mealActivityText(activity: MealActivity, today: string) {
  return {
    title: `${dayName(activity.slot_date, today)}'s ${slotName(activity.meal)}`,
    body: `${whatChanged(activity, today)} · ${activity.actor_name}`,
  };
}

function whatChanged(a: MealActivity, today: string): string {
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
function origin(a: MealActivity, today: string): string {
  const day = inSentence(dayName(a.previous_slot_date!, today));
  const meal = slotName(a.previous_meal!);
  if (a.previous_slot_date === a.slot_date) return meal;
  if (a.previous_meal === a.meal) return day;
  return `${day}'s ${meal}`;
}

function slotName(meal: string): string {
  return SLOT_LABEL[meal as MealSlot].toLowerCase();
}

const inSentence = (day: string) =>
  day === "Today" || day === "Tomorrow" ? day.toLowerCase() : day;

// Parsed as local dates so the day doesn't shift.
function dayName(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === dateKey(addDays(new Date(`${today}T00:00`), 1)))
    return "Tomorrow";
  return WEEKDAY_LONG[new Date(`${date}T00:00`).getDay()]!;
}

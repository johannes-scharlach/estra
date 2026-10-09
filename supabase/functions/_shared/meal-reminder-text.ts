// Meal reminders (spec 0010). Worker-only: reminders never enter the feed.

export type MealReminder = {
  slot_date: string;
  day_meals: { meal: string; name: string }[];
  items_to_buy: number;
};

// One line per day of the week, so the nudge doesn't read the same every day.
export const EMPTY_DAY_LINES = [
  "There's still time to plan it.",
  "Still open. What sounds good?",
  "Nothing planned yet. Plenty of time.",
  "A blank page. Want an idea?",
  "Free tonight. Plan something?",
  "No plan yet, and that's fine. There's still time.",
  "Room for something new tonight.",
];

/**
 * Always "today": retries end hours after 8:00 (ADR 19), within the day.
 * "Today's dinner" / "Lasagne · 2 items still to buy".
 */
export function mealReminderText(reminder: MealReminder) {
  const meals = reminder.day_meals;
  if (!meals.length) {
    return { title: "Tonight's dinner", body: emptyDayLine(reminder.slot_date) };
  }
  const toBuy = reminder.items_to_buy;
  const shopping = toBuy
    ? [`${toBuy} ${toBuy === 1 ? "item" : "items"} still to buy`]
    : [];
  if (meals.length === 1) {
    return {
      title: `Today's ${meals[0]!.meal}`,
      body: [meals[0]!.name, ...shopping].join(" · "),
    };
  }
  return {
    title: "Today",
    body: [
      ...meals.map(({ meal, name }) => `${capitalize(meal)}: ${name}`),
      ...shopping,
    ].join(" · "),
  };
}

function emptyDayLine(date: string): string {
  const days = Date.parse(`${date}T00:00Z`) / 86_400_000;
  return EMPTY_DAY_LINES[days % EMPTY_DAY_LINES.length]!;
}

const capitalize = (word: string) => word[0]!.toUpperCase() + word.slice(1);

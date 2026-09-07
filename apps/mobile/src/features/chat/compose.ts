import { addDays, dateKey, SLOT_LABEL, WEEKDAY_LONG, type MealSlot } from "@/features/meals/slots";

/**
 * The app never puts words in the user's mouth: everything it sends in
 * their name is assembled here from what they actually entered, and these
 * functions are the tested seam for that rule.
 */

/** Home entry: chips (images may accompany). Plain restatement only;
 *  ingredients lowercased so the sentence reads plain. */
export function entryMessage(chips: string[], attachmentCount: number): string {
  const names = chips.map((chip) => chip.toLowerCase());
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  if (attachmentCount && names.length) return `I also have ${list}.`;
  if (names.length) return `I have ${list}.`;
  return attachmentCount > 1 ? "What's in these?" : "What's in here?";
}

/** Planning entry: dates stay explicit when the conversation is resumed later. */
export function mealPlanMessage(opts: {
  slots: { day: string; meal: MealSlot }[];
  notes: string;
  attachmentCount: number;
}): string {
  const meals = opts.slots.map(({ day, meal }) => `- ${day}: ${SLOT_LABEL[meal].toLowerCase()}`);
  return [
    "Help me draft a meal plan for these meals:",
    ...meals,
    opts.notes.trim(),
    opts.attachmentCount === 1 ? "I've attached an image." : "",
    opts.attachmentCount > 1 ? "I've attached some images." : "",
  ].filter(Boolean).join("\n");
}

/** Day named the way the user saw it on the strip: today, tomorrow,
 *  otherwise the weekday; further out adds the date. */
export function dayName(key: string, today: Date = new Date()): string {
  const todayKey = dateKey(today);
  const tomorrowKey = dateKey(addDays(today, 1));
  if (key === todayKey) return "today";
  if (key === tomorrowKey) return "tomorrow";
  const d = new Date(`${key}T12:00:00`);
  const weekday = WEEKDAY_LONG[d.getDay()] ?? key;
  const daysOut = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  return daysOut > 6 ? `${weekday} ${d.getDate()}` : weekday;
}

/** Plan sheet confirm: the full ask, verbatim from the form's choices. */
export function saveAndPlanMessage(
  opts: { day: string; meal: MealSlot; servings: number },
  today: Date = new Date(),
): string {
  const slot = SLOT_LABEL[opts.meal].toLowerCase();
  return `Save this and plan it for ${dayName(opts.day, today)} ${slot}, ${opts.servings} servings.`;
}

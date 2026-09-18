import { dayName } from "@/features/chat/compose";
import { SLOT_LABEL, SLOT_ORDER, type MealSlot } from "@/features/meals/slots";

/** The planned_meals columns this module reads. */
export type MealRow = {
  id: string;
  variant_id: string | null;
  slot_date: string | null;
  meal: string | null;
};

const slotIndex = (meal: string | null) =>
  SLOT_ORDER.indexOf(meal as MealSlot) === -1
    ? SLOT_ORDER.length
    : SLOT_ORDER.indexOf(meal as MealSlot);

/**
 * Which meal a variant page is about (spec 0004). The meal the card opened
 * wins; otherwise the nearest upcoming meal on this variant. A sibling is an
 * upcoming meal on another version of the same recipe. The last past meal
 * is only interesting when nothing is coming up.
 */
export function variantMeals<M extends MealRow>(
  meals: readonly M[],
  opts: { variantId: string; plannedMealId?: string; today: string },
): { selected: M | null; sibling: M | null; lastPast: M | null } {
  const sorted = [...meals].sort(
    (a, b) =>
      (a.slot_date ?? "").localeCompare(b.slot_date ?? "") ||
      slotIndex(a.meal) - slotIndex(b.meal),
  );
  const upcoming = sorted.filter((m) => (m.slot_date ?? "") >= opts.today);
  const selected =
    (opts.plannedMealId
      ? sorted.find((m) => m.id === opts.plannedMealId)
      : undefined) ??
    upcoming.find((m) => m.variant_id === opts.variantId) ??
    null;
  const sibling =
    upcoming.find((m) => m.variant_id !== opts.variantId && m !== selected) ??
    null;
  const past = sorted.filter((m) => (m.slot_date ?? "") < opts.today);
  const lastPast = selected ? null : (past[past.length - 1] ?? null);
  return { selected, sibling, lastPast };
}

/** "Friday · Dinner", "Today · Lunch". Same day wording as the chat message. */
export function mealLabel(meal: MealRow, today: Date = new Date()): string {
  const day = dayName(meal.slot_date ?? "", today);
  const slot = SLOT_LABEL[meal.meal as MealSlot] ?? meal.meal ?? "";
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${slot}`;
}

/** Shopping progress for the meal's list items. */
export function shoppedLabel(items: readonly { status: string | null }[]): string {
  if (items.length === 0) return "Nothing to buy";
  const bought = items.filter((i) => i.status === "purchased").length;
  if (bought === items.length) return "Shopped";
  return `${bought} of ${items.length} shopped`;
}

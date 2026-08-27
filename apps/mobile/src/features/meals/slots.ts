export type MealSlot = "lunch" | "dinner" | "treat";

export const SLOT_ORDER: MealSlot[] = ["lunch", "dinner", "treat"];
export const SLOT_LABEL: Record<MealSlot, string> = {
  lunch: "Lunch",
  dinner: "Dinner",
  treat: "Treat",
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
export const FUTURE_DAYS = 7;

/** Strip runs `pastDays` back through 7 days ahead. */
export function stripDates(pastDays: number = PAST_DAYS): {
  dates: Date[];
  todayIndex: number;
} {
  const today = new Date();
  const dates = Array.from(
    { length: pastDays + 1 + FUTURE_DAYS },
    (_, i) => addDays(today, i - pastDays),
  );
  return { dates, todayIndex: pastDays };
}

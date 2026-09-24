/** Count calendar days, not elapsed 24-hour periods (which break across DST).
 * Dates are local YYYY-MM-DD keys, not instants from the server. */
export function mealAge(slotDate: string | null, today: string): string | null {
  if (!slotDate || slotDate >= today) return null;
  const days = Math.round((Date.parse(today) - Date.parse(slotDate)) / 86_400_000);
  if (!Number.isFinite(days) || days < 1) return null;
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

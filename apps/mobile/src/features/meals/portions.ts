export function isValidPortions(value: number): boolean {
  // Compare a decimal round-trip, not value * 100 (e.g. 0.29 * 100 is inexact).
  return Number.isFinite(value) && value > 0 && Number(value.toFixed(2)) === value;
}

export function parsePortions(text: string): number | null {
  const input = text.trim();
  if (!/^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/.test(input)) return null;
  const value = Number(input.replace(",", "."));
  return isValidPortions(value) ? value : null;
}

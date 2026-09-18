/**
 * A planned meal is who from the household is eating plus extra portions.
 * One extra portion is one adult helping that belongs to nobody: guests,
 * leftovers, or just more food (ADR 12).
 */

export type Eater = { id: string; name: string; self: boolean };

/** Household rows as the picker and labels show them; the caller's own
 *  person is `self` so the UI can say "Me" where the message says "me". */
export function toEaters(
  people: { id: string; name: string; user_id: string | null }[],
  currentUserId: string | null | undefined,
): Eater[] {
  return people.map((p) => ({
    id: p.id,
    name: p.name,
    self: !!currentUserId && p.user_id === currentUserId,
  }));
}

/** Local SQLite holds the JSON array as text; anything unreadable is nobody. */
export function parseEaterIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw !== "string") return [];
  try {
    return parseEaterIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** People removed from the household since the meal was planned are ignored. */
export function whoIsEating(people: Eater[], eaterIds: string[]) {
  const eating = people.filter((p) => eaterIds.includes(p.id));
  const everyone = people.length > 0 && eating.length === people.length;
  return { eating, everyone };
}

export function isValidExtraPortions(value: number): boolean {
  // Compare a decimal round-trip, not value * 100 (e.g. 0.29 * 100 is inexact).
  return Number.isFinite(value) && value >= 0 && Number(value.toFixed(2)) === value;
}

export function parseExtraPortions(text: string): number | null {
  const input = text.trim();
  if (!/^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/.test(input)) return null;
  const value = Number(input.replace(",", "."));
  return isValidExtraPortions(value) ? value : null;
}

export function formatExtraPortions(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** "me, Anna and Ben" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Card badge and menu title: "Everyone", "Me, Anna +1.5 extra". */
export function eatersLabel(opts: {
  people: Eater[];
  eaterIds: string[];
  extraPortions: number;
}): string {
  const { eating, everyone } = whoIsEating(opts.people, opts.eaterIds);
  const who = everyone
    ? "Everyone"
    : eating.length
      ? eating.map((p) => (p.self ? "Me" : p.name)).join(", ")
      : "Nobody";
  const extra =
    opts.extraPortions > 0 ? ` +${formatExtraPortions(opts.extraPortions)} extra` : "";
  return `${who}${extra}`;
}

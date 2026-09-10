import { z } from "zod";

import { IngredientLineSchema } from "../../db/schemas";

export type Alternative = {
  name: string;
  qtyText: string | null;
  prepNote: string | null;
  categoryId: string | null;
};

const linesSchema = z.array(IngredientLineSchema);
const nameKey = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

/** Original first, then recipe alternatives. Ambiguous lines cannot safely cycle. */
export function alternativesForItem(
  name: string,
  raw: string | null,
): Alternative[] {
  let json: unknown;
  try {
    json = JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
  const parsed = linesSchema.safeParse(json);
  if (!parsed.success) return [];
  const matches = parsed.data
    .map((line) => [line, ...(line.swaps ?? [])])
    .filter((options) =>
      options.some((option) => nameKey(option.item_name) === nameKey(name)),
    );
  const match = matches[0];
  if (matches.length !== 1 || !match) return [];
  const seen = new Set<string>();
  return match
    .filter((option) => {
      const key = nameKey(option.item_name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((option) => ({
      name: option.item_name,
      qtyText: option.qty_text,
      prepNote: option.prep_note ?? null,
      categoryId: option.category_id ?? null,
    }));
}

export function adjacentAlternative(
  name: string,
  options: Alternative[],
  direction: 1 | -1,
) {
  const current = options.findIndex(
    (option) => nameKey(option.name) === nameKey(name),
  );
  if (current < 0 || options.length < 2) return null;
  return options[(current + direction + options.length) % options.length];
}

/** A browsing strip has ends; rotate only when starting a new session. */
export function orderedAlternatives(name: string, options: Alternative[]) {
  const current = options.findIndex(
    (option) => nameKey(option.name) === nameKey(name),
  );
  if (current < 0) return [];
  return [...options.slice(current), ...options.slice(0, current)];
}

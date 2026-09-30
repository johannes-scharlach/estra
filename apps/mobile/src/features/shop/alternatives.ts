import { ingredientOptions, itemNameKey as nameKey, lineForItem, type IngredientLine } from "@estra/meals";
import { z } from "zod";

import { IngredientLineSchema } from "../../db/schemas";

export type Alternative = {
  name: string;
  qtyText: string | null;
  prepNote: string | null;
  categoryId: string | null;
};

const linesSchema = z.array(IngredientLineSchema);

/** Original first, then recipe alternatives. Ambiguous lines cannot safely cycle. */
export function alternativesForItem(
  name: string,
  raw: string | null,
  ingredientId?: number | null,
): Alternative[] {
  let json: unknown;
  try {
    json = JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
  const parsed = linesSchema.safeParse(json);
  if (!parsed.success) return [];
  const line = ingredientId != null
    ? parsed.data.find((line) => line.id === ingredientId)
    : lineForItem(name, parsed.data)?.line;
  return line ? alternativesForLine(line) : [];
}

/** The line's own ingredient first, then its swaps, without duplicates. */
export function alternativesForLine(line: IngredientLine): Alternative[] {
  return ingredientOptions(line)
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

/**
 * Rules shared by the app and the API for meal-owned ingredient choices,
 * stable ingredient identity and purchase snapshots (ADR 20). Plain types,
 * no zod: each app validates at its boundary and passes the parsed shapes in.
 *
 * One file on purpose. The API type-checks this source under nodenext and
 * Metro bundles it; a single module needs no internal import extensions.
 */

export type Swap = {
  qty_text: string | null;
  item_name: string;
  prep_note?: string;
  category_id?: string;
  /** Why a cook would pick this over the line's own ingredient. */
  reason?: string;
};

export type IngredientLine = Swap & {
  /** Stable within a recipe, preserved when a variant keeps this ingredient. */
  id?: number;
  swaps?: Swap[];
  shopping_hint?: "check_at_home" | "likely_purchase";
};

/** The projection of a `list_items` row this package needs. */
export type MealItem = {
  ingredient_id?: number | null;
  name: string | null;
  spec: string | null;
  status: string | null;
};

/**
 * The dedupe key. 'Oat Milk  ' and 'oat milk' are the same thing on a
 * shopping list. Feeds uuidv5 item ids on the client: never change it.
 */
export function itemNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The recipe line an item belongs to: the one whose ingredient, or one of
 * whose listed swaps, has this name. Null when no line or more than one
 * line claims it; an ambiguous line cannot safely swap or scale.
 */
export function lineForItem<L extends IngredientLine>(
  name: string,
  lines: readonly L[],
): { index: number; line: L } | null {
  const key = itemNameKey(name);
  let found: { index: number; line: L } | null = null;
  for (const [index, line] of lines.entries()) {
    const names = [line, ...(line.swaps ?? [])];
    if (!names.some((option) => itemNameKey(option.item_name) === key)) continue;
    if (found) return null;
    found = { index, line };
  }
  return found;
}

/**
 * Who a variant was adjusted for: the meal's eaters and extra at the time
 * the adjust route wrote it (`variants.sized_for`). Null for a variant as
 * imported or written by hand — its yield text is the only sizing it has.
 */
export type SizedFor = { eater_ids: string[]; extra_portions: number };

export type MealSync = {
  /** "match": adjusted for exactly these eaters and extra. "differs": for
   *  others. "unknown": never adjusted; the recipe is sized as written. */
  sizing: "match" | "differs" | "unknown";
  /** Meal choices that the recipe's steps don't know about. */
  swaps: number;
  /** Nothing to adjust: sized for this meal and no swaps pending. */
  inSync: boolean;
};

/**
 * Whether the recipe still describes the meal. The variant the adjust route
 * writes folds the swaps into its lines, so any meal choice against
 * it is new drift; and its stamp says who it was sized for. Sets compare
 * by id, never by name.
 */
export function mealSync(
  sizedFor: SizedFor | null,
  meal: SizedFor,
  ingredients: readonly { swap: Swap | null }[],
): MealSync {
  const swaps = ingredients.filter((state) => state.swap).length;
  const sizing = !sizedFor
    ? "unknown"
    : sameEaters(sizedFor, meal)
      ? "match"
      : "differs";
  return { sizing, swaps, inSync: sizing === "match" && swaps === 0 };
}

/** Alternative indexes in the meal's current variant, keyed by ingredient id. */
export type MealSwaps = Record<string, number>;

export function parseMealSwaps(raw: string | null | undefined): MealSwaps {
  if (!raw) return {};
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.entries(value).some(([id, option]) =>
      !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(option) || Number(option) < 0,
    )
  ) {
    throw new Error("Invalid meal ingredient choices");
  }
  return value as MealSwaps;
}

export function ingredientOptions(line: IngredientLine): Swap[] {
  const seen = new Set<string>();
  return [line, ...(line.swaps ?? [])].filter((option) => {
    const key = itemNameKey(option.item_name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mealIngredients<L extends IngredientLine>(
  lines: readonly L[],
  swaps: MealSwaps,
) {
  return lines.map((line) => {
    const optionIndex = line.id == null ? 0 : (swaps[line.id] ?? 0);
    const chosen = ingredientOptions(line)[optionIndex];
    if (!chosen) {
      throw new Error("This meal's ingredient choices no longer match its recipe");
    }
    return { line, optionIndex, swap: optionIndex ? chosen : null, chosen };
  });
}

/** Clear incorporated choices; carry unapplied choices across option reordering.
 * Removing an ingredient removes its choice, not any purchased snapshot. */
export function rebaseMealSwaps(
  previous: readonly IngredientLine[],
  swaps: MealSwaps,
  next: readonly IngredientLine[],
): MealSwaps {
  const rebased: MealSwaps = {};
  for (const { line, swap } of mealIngredients(previous, swaps)) {
    if (!swap || line.id == null) continue;
    const replacement = next.find((candidate) => candidate.id === line.id);
    if (!replacement) continue;
    const index = ingredientOptions(replacement).findIndex(
      (option) => itemNameKey(option.item_name) === itemNameKey(swap.item_name),
    );
    if (index < 0) {
      throw new Error(`The revised recipe must use or retain the meal's choice of ${swap.item_name}`);
    }
    if (index > 0) rebased[line.id] = index;
  }
  return rebased;
}

export function ingredientSpec(line: Swap): string | null {
  return (
    [line.qty_text?.trim(), line.prep_note].filter(Boolean).join(", ") || null
  );
}

/** Active items follow the meal. Purchases and unlinked items are snapshots. */
export function resolveMealItem<I extends MealItem & { category_id: string | null }>(
  item: I,
  lines: readonly IngredientLine[],
  swaps: MealSwaps,
): I {
  if (item.status === "purchased" || item.ingredient_id == null) return item;
  const line = lines.find((line) => line.id === item.ingredient_id);
  if (!line) return item;
  const chosen = mealIngredients([line], swaps)[0]!.chosen;
  return {
    ...item,
    name: chosen.item_name,
    spec: ingredientSpec(chosen),
    category_id: chosen.category_id ?? null,
  };
}

/** Allocate only genuinely new ingredients. Never infer identity from names. */
export function assignIngredientIds<L extends IngredientLine>(
  lines: readonly L[],
  nextId: number,
  base: readonly IngredientLine[] = [],
): { lines: (L & { id: number })[]; nextId: number } {
  const allowed = new Set(base.map((line) => line.id));
  const used = new Set<number>();
  const assigned = lines.map((line) => {
    const id = line.id ?? nextId++;
    if (
      !Number.isSafeInteger(id) || id < 1 || used.has(id) ||
      (line.id != null && !allowed.has(id))
    ) {
      throw new Error(
        "Ingredient ids must be unique and preserved from the base variant; omit ids for new ingredients",
      );
    }
    used.add(id);
    return { ...line, id };
  });
  return { lines: assigned, nextId };
}

function sameEaters(a: SizedFor, b: SizedFor): boolean {
  if (a.extra_portions !== b.extra_portions) return false;
  const ids = new Set(a.eater_ids);
  return (
    ids.size === new Set(b.eater_ids).size &&
    b.eater_ids.every((id) => ids.has(id))
  );
}

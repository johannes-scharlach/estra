/**
 * Rules shared by the app and the API about how a planned meal's shopping
 * items relate to its recipe lines (ADR 13). Plain types, no zod: each app
 * validates at its own boundary and passes the parsed shapes in.
 *
 * One file on purpose. The API type-checks this source under nodenext and
 * Metro bundles it; a single module needs no internal import extensions.
 */

export type Swap = {
  qty_text: string | null;
  item_name: string;
  prep_note?: string;
  category_id?: string;
};

export type IngredientLine = Swap & { swaps?: Swap[] };

/** The projection of a `list_items` row this package needs. */
export type MealItem = {
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

export type LineState<L extends IngredientLine, I extends MealItem> = {
  line: L;
  /** The list item for this line, or null when it was removed from the list. */
  item: I | null;
  /** Set when the item is one of the line's swaps rather than the original. */
  swap: Swap | null;
};

export type MealDelta<L extends IngredientLine, I extends MealItem> = {
  lines: LineState<L, I>[];
  /** Items that match no line (renamed by hand) or a line already taken. */
  extra: I[];
  /** At least one item, and every one of them checked off. */
  shopped: boolean;
};

/** What the shopping list says about each recipe line. Nothing is guessed. */
export function mealDelta<L extends IngredientLine, I extends MealItem>(
  lines: readonly L[],
  items: readonly I[],
): MealDelta<L, I> {
  const states: LineState<L, I>[] = lines.map((line) => ({
    line,
    item: null,
    swap: null,
  }));
  const extra: I[] = [];
  for (const item of items) {
    const match = item.name ? lineForItem(item.name, lines) : null;
    const state = match ? states[match.index] : undefined;
    if (!match || !state || state.item) {
      extra.push(item);
      continue;
    }
    const key = itemNameKey(item.name ?? "");
    const swap =
      itemNameKey(match.line.item_name) === key
        ? null
        : ((match.line.swaps ?? []).find(
            (option) => itemNameKey(option.item_name) === key,
          ) ?? null);
    state.item = item;
    state.swap = swap;
  }
  const shopped =
    items.length > 0 && items.every((item) => item.status === "purchased");
  return { lines: states, extra, shopped };
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
  /** Lines the list swapped that the recipe's steps don't know about. */
  swaps: number;
  /** Nothing to adjust: sized for this meal and no swaps pending. */
  inSync: boolean;
};

/**
 * Whether the recipe still describes the meal. The variant the adjust route
 * writes folds the swaps into its lines, so any swap the list shows against
 * it is new drift; and its stamp says who it was sized for. Sets compare
 * by id, never by name.
 */
export function mealSync(
  sizedFor: SizedFor | null,
  meal: SizedFor,
  delta: MealDelta<IngredientLine, MealItem>,
): MealSync {
  const swaps = delta.lines.filter((state) => state.swap).length;
  const sizing = !sizedFor
    ? "unknown"
    : sameEaters(sizedFor, meal)
      ? "match"
      : "differs";
  return { sizing, swaps, inSync: sizing === "match" && swaps === 0 };
}

function sameEaters(a: SizedFor, b: SizedFor): boolean {
  if (a.extra_portions !== b.extra_portions) return false;
  const ids = new Set(a.eater_ids);
  return (
    ids.size === new Set(b.eater_ids).size &&
    b.eater_ids.every((id) => ids.has(id))
  );
}

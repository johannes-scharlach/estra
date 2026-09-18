import { mealDelta, type IngredientLine } from "@estra/meals";
import type { PoolClient } from "pg";

import { inTransaction, pool } from "./db.js";
import { PlannedMealChangedError, PlannedMealNotFoundError, VariantNotFoundError } from "./errors.js";
import { assertListMember, assertListMemberUntilCommit } from "./list-authorization.js";
import type { CookRecipeInput } from "./recipe-schema.js";
import { findVariantIdentity, insertVariant } from "./variants.js";

/**
 * Adjusting a planned meal (ADR 13): a new variant under the same recipe,
 * sized for the meal's eaters and extra with the shopping list's swaps
 * folded in. The meal is repointed; its list items are never reprojected,
 * because they are the input.
 */

type MealRow = {
  id: string;
  list_id: string;
  recipe_id: string;
  variant_id: string;
  slot_date: string;
  meal: string;
  eater_ids: string[];
  extra_portions: number;
};
type VariantRow = {
  name: string;
  description: string | null;
  locale: string;
  total_time: string | null;
  recipe_yield: string | null;
  content_markdown: string | null;
  recipe_category: string | null;
  recipe_cuisine: string | null;
  ingredient_lines: IngredientLine[];
  instructions: unknown[];
};
type ItemRow = { name: string; spec: string | null; status: string };
type Person = { id: string; name: string; age_group: string | null; diet: string | null; diet_other: string | null };

export type AdjustContext = {
  meal: MealRow;
  variant: VariantRow;
  items: ItemRow[];
  eaters: Person[];
};

export type AdjustResult = { recipeId: string; variantId: string };

/** Everything the rewrite needs, or the finished result if this operation already ran. */
export async function loadAdjustContext(
  userId: string,
  plannedMealId: string,
  variantId: string,
): Promise<{ existing: AdjustResult } | { context: AdjustContext }> {
  const client = await pool.connect();
  try {
    const meal = (
      await client.query<MealRow>(
        `SELECT id, list_id, recipe_id, variant_id, slot_date, meal, eater_ids, extra_portions
         FROM planned_meals WHERE id = $1`,
        [plannedMealId],
      )
    ).rows[0];
    if (!meal) throw new PlannedMealNotFoundError();
    await assertListMember(client, userId, meal.list_id);

    const existing = await findVariantIdentity(client, variantId);
    if (existing) return { existing };

    const variant = (
      await client.query<VariantRow>(
        `SELECT name, description, locale, total_time, recipe_yield, content_markdown,
                recipe_category, recipe_cuisine, ingredient_lines, instructions
         FROM variants WHERE id = $1`,
        [meal.variant_id],
      )
    ).rows[0];
    if (!variant) throw new VariantNotFoundError();

    const items = (
      await client.query<ItemRow>(
        "SELECT name, spec, status FROM list_items WHERE planned_meal_id = $1 ORDER BY created_at, id",
        [plannedMealId],
      )
    ).rows;
    const people = (
      await client.query<Person>(
        "SELECT id, name, age_group, diet, diet_other FROM household_people WHERE list_id = $1 ORDER BY created_at, id",
        [meal.list_id],
      )
    ).rows;
    // People removed from the household since are not eating anymore.
    const eaters = people.filter((p) => meal.eater_ids.includes(p.id));
    return { context: { meal, variant, items, eaters } };
  } finally {
    client.release();
  }
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** The ask, in words. The schema descriptions carry the ingredient format. */
export function adjustPrompt({ meal, variant, items, eaters }: AdjustContext): string {
  const delta = mealDelta(variant.ingredient_lines, items);
  const swaps = delta.lines
    .filter((s) => s.swap && s.item)
    .map((s) => {
      const spec = [s.item?.spec].filter(Boolean).join(", ");
      return `- Use "${s.item?.name}"${spec ? ` (${spec})` : ""} instead of "${s.line.item_name}".`;
    });
  const extra = delta.extra.map((i) => `- ${i.name}${i.spec ? ` (${i.spec})` : ""}`);
  const who = eaters.map((p) => {
    const diet = p.diet === "other" ? p.diet_other : p.diet;
    return `${p.name} (${[p.age_group ?? "adult", diet].filter(Boolean).join(", ")})`;
  });
  const extraPortions = meal.extra_portions > 0 ? `, plus ${meal.extra_portions} extra portions (one extra portion is one adult helping)` : "";
  const yieldFor = `Sized for ${joinNames(eaters.map((p) => p.name))}${meal.extra_portions > 0 ? ` + ${meal.extra_portions} extra` : ""}`;

  return [
    "You are adjusting a saved recipe to the meal it is planned for. Return the complete recipe in the same JSON shape.",
    "",
    `Keep the language (locale "${variant.locale}"), the dish name, the voice, the structure and the order of steps, and every detail you are not told to change. Keep contentMarkdown consistent with the changes.`,
    "",
    `Eating: ${who.length ? who.join("; ") : "the household"}${extraPortions}.`,
    `The recipe as written says it serves: "${variant.recipe_yield ?? "unknown"}". Scale every amount for exactly these eaters and extra. A child eats less than an adult; a teenager about as much.`,
    `Write recipeYield as who it is sized for: "${yieldFor}".`,
    "",
    ...(swaps.length
      ? [
          "The shopping list swapped these ingredients. Make each the line's item_name with its own qty_text and prep_note, list the original as one of that line's swaps, and rewrite any step text that names the original:",
          ...swaps,
          "",
        ]
      : []),
    ...(extra.length
      ? [
          "Also on the shopping list for this meal, matching no line. If one is clearly a replacement for a recipe line, treat it as a swap; otherwise ignore it:",
          ...extra,
          "",
        ]
      : []),
    "Current recipe:",
    JSON.stringify(
      {
        name: variant.name,
        description: variant.description,
        locale: variant.locale,
        totalTime: variant.total_time,
        recipeYield: variant.recipe_yield,
        contentMarkdown: variant.content_markdown,
        recipeIngredient: variant.ingredient_lines,
        recipeInstructions: variant.instructions,
        recipeCategory: variant.recipe_category,
        recipeCuisine: variant.recipe_cuisine,
      },
      null,
      2,
    ),
  ].join("\n");
}

/** Insert the new version and repoint the meal. Never touches list item rows beyond variant_id. */
export async function saveAdjusted(opts: {
  userId: string;
  plannedMealId: string;
  variantId: string;
  context: AdjustContext;
  recipe: CookRecipeInput;
}): Promise<AdjustResult> {
  const { userId, plannedMealId, variantId, context, recipe } = opts;
  const { list_id: listId, recipe_id: recipeId, variant_id: oldVariantId } = context.meal;
  return inTransaction(async (client: PoolClient) => {
    await assertListMemberUntilCommit(client, userId, listId);
    // Same lock as imports: a concurrent retry waits, then finds the result.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [variantId]);
    const existing = await findVariantIdentity(client, variantId);
    if (existing) return existing;

    await insertVariant(client, { recipeId, variantId, recipe });
    const repointed = await client.query(
      "UPDATE planned_meals SET variant_id = $1, updated_at = now() WHERE id = $2 AND variant_id = $3",
      [variantId, plannedMealId, oldVariantId],
    );
    if (!repointed.rowCount) throw new PlannedMealChangedError();
    // Alternatives on the shop page resolve against the item's variant.
    await client.query(
      "UPDATE list_items SET variant_id = $1 WHERE planned_meal_id = $2",
      [variantId, plannedMealId],
    );
    return { recipeId, variantId };
  });
}

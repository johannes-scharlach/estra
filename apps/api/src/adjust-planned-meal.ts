import { ingredientSpec, mealIngredients, type MealSwaps, type IngredientLine } from "@estra/meals";
import type { PoolClient } from "pg";

import { inTransaction, pool } from "./db.js";
import {
  PlannedMealNotFoundError,
  VariantNotFoundError,
} from "./errors.js";
import {
  assertListMember,
  assertListMemberUntilCommit,
} from "./list-authorization.js";
import type { CookRecipeInput } from "./recipe-schema.js";
import { findVariantIdentity, insertVariant } from "./variants.js";
import { repointMealVariant } from "./reconcile-meal-shopping.js";

/**
 * Adjusting a planned meal (ADR 13): a new variant under the same recipe,
 * sized for the meal's eaters and extra with its choices folded in.
 * Shopping links reconcile by ingredient id; purchases retain their snapshots.
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
  ingredient_swaps: MealSwaps;
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
type Person = {
  id: string;
  name: string;
  age_group: string | null;
  diet: string | null;
  diet_other: string | null;
};

export type AdjustContext = {
  meal: MealRow;
  variant: VariantRow;
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
        `SELECT id, list_id, recipe_id, variant_id, slot_date, meal, eater_ids, extra_portions, ingredient_swaps
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

    const people = (
      await client.query<Person>(
        "SELECT id, name, age_group, diet, diet_other FROM household_people WHERE list_id = $1 ORDER BY created_at, id",
        [meal.list_id],
      )
    ).rows;
    // People removed from the household since are not eating anymore.
    const eaters = people.filter((p) => meal.eater_ids.includes(p.id));
    return { context: { meal, variant, eaters } };
  } finally {
    client.release();
  }
}

const joinNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** The ask, in words. The schema descriptions carry the ingredient format. */
export function adjustPrompt({
  meal,
  variant,
  eaters,
}: AdjustContext): string {
  const swaps = mealIngredients(variant.ingredient_lines, meal.ingredient_swaps)
    .filter((s) => s.swap)
    .map((s) => {
      const spec = ingredientSpec(s.chosen);
      return `- Ingredient id ${s.line.id}: use "${s.chosen.item_name}"${spec ? ` (${spec})` : ""} instead of "${s.line.item_name}". Preserve id ${s.line.id}.`;
    });
  const who = eaters.map((p) => {
    const diet = p.diet === "other" ? p.diet_other : p.diet;
    return `${p.name} (${[p.age_group ?? "adult", diet].filter(Boolean).join(", ")})`;
  });
  const extraPortions =
    meal.extra_portions > 0
      ? `, plus ${meal.extra_portions} extra portions (one extra portion is one adult helping)`
      : "";
  const yieldFor = `Sized for ${joinNames(eaters.map((p) => p.name))}${meal.extra_portions > 0 ? ` + ${meal.extra_portions} extra` : ""}`;

  return [
    "You are adjusting a saved recipe to the meal it is planned for. Return the complete recipe in the same JSON shape.",
    "Preserve each continuing ingredient's id, including substitutions and quantity changes. Omit id only for genuinely new ingredients. Do not renumber ingredients when reordering or removing them.",
    "",
    `Keep the language (locale "${variant.locale}"), the voice, the structure and the order of steps, and every detail you are not told to change. Keep the dish name unless a swap replaces an ingredient the name mentions; then rename the dish to match. The name, description and instructions must agree with the ingredient lines you return: nothing may still name an ingredient that was swapped out. contentMarkdown is only for useful context not covered by the structured fields; do not put ingredients or steps there, and update contextual notes if a swap makes them inaccurate.`,
    `A swap may change how the food is cooked or how long it takes — often that is exactly why the cook picked it. Follow the consequence through: rewrite every step whose method, order or timing it affects, and set totalTime to the new wall-clock time from the first thing the cook does until the food is ready. Never keep the old time when the work changed. Say so in the description too, when a shortcut is what makes this version different.`,
    "",
    `Eating: ${who.length ? who.join("; ") : "the household"}${extraPortions}.`,
    `The recipe as written says it serves: "${variant.recipe_yield ?? "unknown"}". Scale every amount, including each step's ingredient amounts, for exactly these eaters and extra. A child eats less than an adult; a teenager about as much.`,
    `Write recipeYield as who it is sized for: "${yieldFor}".`,
    "",
    ...(swaps.length
      ? [
          "The meal uses these choices, whether bought or already at home. Make each the line's item_name exactly as named in the choice with its own qty_text and prep_note, list the original as one of that line's swaps, and rewrite any step name or step text that names the original:",
          ...swaps,
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

/** Insert the new version, incorporate choices and reconcile shopping atomically. */
export async function saveAdjusted(opts: {
  userId: string;
  plannedMealId: string;
  variantId: string;
  context: AdjustContext;
  recipe: CookRecipeInput;
}): Promise<AdjustResult> {
  const { userId, plannedMealId, variantId, context, recipe } = opts;
  const {
    list_id: listId,
    recipe_id: recipeId,
    variant_id: oldVariantId,
  } = context.meal;
  return inTransaction(userId, async (client: PoolClient) => {
    await assertListMemberUntilCommit(client, userId, listId);
    // Same lock as imports: a concurrent retry waits, then finds the result.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [variantId],
    );
    const existing = await findVariantIdentity(client, variantId);
    if (existing) return existing;

    // The stamp is the meal as loaded, the same input the prompt was built
    // from; the device compares it to the meal's current values.
    await insertVariant(client, {
      recipeId,
      variantId,
      recipe,
      baseVariantId: oldVariantId,
      sizedFor: {
        eater_ids: context.meal.eater_ids,
        extra_portions: context.meal.extra_portions,
      },
    });
    await repointMealVariant(client, { mealId: plannedMealId, variantId,
      expectedVariantId: oldVariantId, expectedSwaps: context.meal.ingredient_swaps });
    return { recipeId, variantId };
  });
}

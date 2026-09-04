import { randomUUID } from "node:crypto";

import { pool } from "./db.js";
import type { RecipeInput } from "./recipe-schema.js";

/**
 * ADR 8: `recipes` is a thin grouping bucket, `variants` is the cookable
 * entity. A new recipe gets both rows; an update to an existing recipe is a
 * new variant on the same recipe — older ones stay browsable.
 */
export async function insertVariant(opts: {
  userId: string;
  recipe: RecipeInput;
  /** Existing recipe to add this variant to. Omit to create a new recipe. */
  recipeId?: string;
}): Promise<{ recipeId: string; variantId: string }> {
  const { userId, recipe } = opts;
  const recipeId = opts.recipeId ?? randomUUID();
  const variantId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!opts.recipeId) {
      await client.query(
        `INSERT INTO recipes (id, from_name, from_url, created_by)
         VALUES ($1,$2,$3,$4)`,
        [recipeId, recipe.from?.name ?? null, recipe.from?.url ?? null, userId],
      );
    }
    await client.query(
      `INSERT INTO variants (id, recipe_id, name, description, locale, total_time, recipe_yield, content_markdown, recipe_category, recipe_cuisine, ingredient_lines, instructions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)`,
      [
        variantId,
        recipeId,
        recipe.name,
        recipe.description,
        recipe.locale,
        recipe.totalTime,
        recipe.recipeYield,
        recipe.contentMarkdown ?? null,
        recipe.recipeCategory ?? null,
        recipe.recipeCuisine ?? null,
        JSON.stringify(recipe.recipeIngredient),
        JSON.stringify(recipe.recipeInstructions),
      ],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return { recipeId, variantId };
}

/** Deep link the app resolves to the variant screen. */
export function variantUrl(variantId: string): string {
  return `estra://variant/${variantId}`;
}

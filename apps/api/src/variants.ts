import type { SizedFor } from "@estra/meals";
import { randomUUID } from "node:crypto";
import type { Client, PoolClient } from "pg";

import type { RecipeInput } from "./recipe-schema.js";

export async function findVariantIdentity(
  client: Client,
  variantId: string,
): Promise<{ recipeId: string; variantId: string } | null> {
  const result = await client.query<{ recipe_id: string }>(
    "SELECT recipe_id FROM variants WHERE id = $1", [variantId],
  );
  const row = result.rows[0];
  return row ? { recipeId: row.recipe_id, variantId } : null;
}

/** Create the recipe grouping explicitly before adding its first variant. */
export async function createRecipe(
  client: PoolClient,
  userId: string,
  from?: RecipeInput["from"],
): Promise<string> {
  const recipeId = randomUUID();
  await client.query(
    `INSERT INTO recipes (id, from_name, from_url, created_by) VALUES ($1,$2,$3,$4)`,
    [recipeId, from?.name ?? null, from?.url ?? null, userId],
  );
  return recipeId;
}

/** A variant always belongs to an existing recipe grouping. */
export async function insertVariant(
  client: PoolClient,
  opts: {
    recipeId: string;
    variantId: string;
    recipe: RecipeInput;
    /** Who the adjust route sized it for; omitted for imports. */
    sizedFor?: SizedFor;
  },
): Promise<{ recipeId: string; variantId: string }> {
  const { recipeId, variantId, recipe, sizedFor } = opts;
  await client.query(
    `INSERT INTO variants (id, recipe_id, name, description, locale, total_time, recipe_yield, content_markdown, recipe_category, recipe_cuisine, ingredient_lines, instructions, sized_for)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb)`,
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
      sizedFor ? JSON.stringify(sizedFor) : null,
    ],
  );
  return { recipeId, variantId };
}

/** Deep link the app resolves to the variant screen. */
export function variantUrl(variantId: string): string {
  return `estra://variant/${variantId}`;
}

import { magpieUuidV5 } from "@/lib/magpie-uuid";

import type { Recipe, Variant } from "./schema";

type Tx = {
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
  getOptional: (sql: string, params: unknown[]) => Promise<unknown>;
};

// Twin of public.copy_variant (ADR 27): same ids, so a copy made offline and
// one made by the server or another device are the same rows.
export function copiedVariantId(listId: string, sourceVariantId: string) {
  return magpieUuidV5(JSON.stringify(["variant-copy", listId, sourceVariantId]));
}

function copiedRecipeId(listId: string, sourceVariantId: string) {
  return magpieUuidV5(JSON.stringify(["recipe-copy", listId, sourceVariantId]));
}

/**
 * The variant to plan in `listId`: the source when it lives there, otherwise
 * that list's copy of it, made now if it doesn't exist yet. The copy drops
 * what belongs to the source household: sized_for, origin, created_by.
 */
export async function variantInList(
  tx: Tx,
  source: Variant,
  listId: string,
): Promise<{ recipeId: string; variantId: string }> {
  if (source.list_id === listId)
    return { recipeId: source.recipe_id!, variantId: source.id };
  const recipeId = copiedRecipeId(listId, source.id);
  const variantId = copiedVariantId(listId, source.id);
  if (await tx.getOptional("SELECT id FROM variants WHERE id = ?", [variantId]))
    return { recipeId, variantId };

  const recipe = (await tx.getOptional("SELECT * FROM recipes WHERE id = ?", [
    source.recipe_id,
  ])) as Recipe | null;
  const now = new Date().toISOString();
  if (!(await tx.getOptional("SELECT id FROM recipes WHERE id = ?", [recipeId])))
    await tx.execute(
      `INSERT INTO recipes (id, list_id, from_name, from_url, next_ingredient_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [recipeId, listId, recipe?.from_name ?? null, recipe?.from_url ?? null,
        recipe?.next_ingredient_id ?? 1, now, now],
    );
  await tx.execute(
    `INSERT INTO variants (id, recipe_id, list_id, name, description, locale, total_time, recipe_yield,
       content_markdown, recipe_category, recipe_cuisine, ingredient_lines, instructions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [variantId, recipeId, listId, source.name, source.description, source.locale,
      source.total_time, source.recipe_yield, source.content_markdown, source.recipe_category,
      source.recipe_cuisine, source.ingredient_lines, source.instructions, now, now],
  );
  return { recipeId, variantId };
}

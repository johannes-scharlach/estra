import type { Recipe, Variant } from "@/db/schema";

export type RecipeChoice = {
  variant: Variant;
  olderVariant: boolean;
  variantCount: number;
};

/** Browse recipe groups; search picks the newest matching variant of each. */
export function recipeChoices(
  recipes: Pick<Recipe, "id" | "created_at">[],
  variants: Variant[],
  search = "",
): RecipeChoice[] {
  const query = search.trim().toLocaleLowerCase();
  const groups = new Map<string, Variant[]>();
  for (const variant of variants) {
    if (!variant.recipe_id) continue;
    const group = groups.get(variant.recipe_id) ?? [];
    group.push(variant);
    groups.set(variant.recipe_id, group);
  }
  const recent = [...recipes].sort(
    (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || a.id.localeCompare(b.id),
  );
  return recent.flatMap((recipe) => {
    const alternatives = groups.get(recipe.id) ?? [];
    alternatives.sort(
      (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || a.id.localeCompare(b.id),
    );
    const variant = alternatives.find((v) =>
      !query || [v.name, v.description, v.recipe_cuisine, v.recipe_category, v.ingredient_lines]
        .some((text) => text?.toLocaleLowerCase().includes(query)),
    );
    return variant ? [{ variant, olderVariant: variant.id !== alternatives[0]?.id, variantCount: alternatives.length }] : [];
  });
}

# 8. Variant is the recipe

Date: 2026-08-25
Status: Accepted
Supersedes: 6 (in part)

## Context

After moving recipe import to server-side Postgres (`apps/api/src/routes/recipes.ts`) we re-examined what belongs on `recipes` vs `variants`.

A recipe import like "Warm lemon-olive and sardine bulgur bowl" carries name, description, total_time, yield, locale, content_markdown, category/cuisine. Changing bulgur -> orzo (or bulgur -> potato, technique change oven vs air-fryer, yield tweak) invalidates almost all of those. Yield is not a different recipe — it's a variant concern. Even total_time changes if you switch to a potato salad.

We also wanted 1:1 swaps precomputed at import (bulgur->couscous, sardine->tuna) to be available offline for the shopping list. Storing them as a separate `swap_suggestions` table keyed to `recipes` required a join and hid which `prep_note` belongs where (jarred roasted peppers are "drained" vs fresh bell peppers "thinly sliced"). Deterministic `uuidv5(recipeId, swaps)` ids (`apps/mobile/src/db/variants.ts:26`, `supabase/migrations/20260824100000_recipes_variants_meals.sql:28`) tried to deduplicate but put us in a corner — same swaps with different technique (air-fryer vs pan) should be two distinct cookable variants, not one overwritten row. Chat-generated variants (ADR 6) already need random ids.

We can purge the DB, so no backwards migration needed.

## Decision

* `recipes` is a thin grouping bucket only: `id, from_name, from_url, created_by, created_at, updated_at`. No display fields.
* `variants` is the cookable entity and holds everything previously on `recipes` plus its own: `recipe_id, name, description, locale, total_time, recipe_yield, content_markdown, recipe_category, recipe_cuisine, ingredient_lines, instructions, created_at, updated_at`. `id` is `gen_random_uuid()` (random), not deterministic.
* `ingredient_lines` jsonb array is `[{qty_text, item_name, prep_note, category_id, swaps: [{qty_text, item_name, prep_note, category_id}]}]`. 1:1 alternatives are embedded on the line that owns them, precomputed at import by Gemini. This makes shopping-list lookup trivial (no extra table, prep_note travels with the swap — fresh vs jarred case).
* Drop `variants.swaps` column and `swap_suggestions` table. Derived variants are just new `variants` rows with their own `ingredient_lines` (and rewritten `name/description/.../instructions`); no need to record which swaps produced them beyond their content. Duplicate content is fine — technique variants are intentionally distinct.
* `planned_meals` already points at `variant_id` (`supabase/migrations/20260824100000:70`), so meal planning is variant-first.

## Consequences

* Queries shift from `SELECT * FROM recipes` to `SELECT * FROM variants` for display; recipe lists become `SELECT DISTINCT recipe_id` grouping or "latest variant per recipe" queries.
* `powersync/sync-config.yaml` and `apps/mobile/src/db/schema.ts` mirror the new shape; `swap_suggestions` stream removed.
* Import (`apps/api/src/routes/recipes.ts`) now asks Gemini for `recipeIngredient[].swaps[]` (each with `qty_text/item_name/prep_note/category_id`) and inserts the full variant row server-side in one TX.
* Purging means we do not need to copy old data; new migration recreates tables as above.

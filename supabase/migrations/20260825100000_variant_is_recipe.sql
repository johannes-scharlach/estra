-- ADR 8: Variant is the recipe. Purge is allowed — this migration rewrites the
-- shape introduced in 20260824100000 so a fresh `pnpm db:reset` lands on the new
-- model without needing a data copy.
--
-- recipes becomes thin (identity + provenance only).
-- variants becomes the cookable entity (all display fields + ingredient_lines
-- with embedded swaps). Deterministic uuidv5 + swap_suggestions are removed.

-- --------------------------------------------------------------------------
-- 1. Drop swap_suggestions (global stream removed in powersync/sync-config.yaml)
-- --------------------------------------------------------------------------
alter publication powersync drop table public.swap_suggestions;

drop policy if exists "swap_suggestions are readable" on public.swap_suggestions;
drop policy if exists "swap_suggestions are writable" on public.swap_suggestions;
revoke all on public.swap_suggestions from authenticated, service_role, anon;
drop table public.swap_suggestions;

-- --------------------------------------------------------------------------
-- 2. Thin recipes — keep only provenance
-- --------------------------------------------------------------------------
alter table public.recipes
  drop column if exists name,
  drop column if exists description,
  drop column if exists locale,
  drop column if exists total_time,
  drop column if exists recipe_yield,
  drop column if exists content_markdown,
  drop column if exists recipe_category,
  drop column if exists recipe_cuisine;

-- --------------------------------------------------------------------------
-- 3. Thicken variants — all display fields move here
--    ingredient_lines jsonb now: [{qty_text,item_name,prep_note,category_id,
--                                   swaps:[{qty_text,item_name,prep_note,category_id}]}]
-- --------------------------------------------------------------------------
-- id was deterministic in 20260824100000; make it random.
alter table public.variants alter column id set default gen_random_uuid();

alter table public.variants
  add column if not exists name              text,
  add column if not exists description       text,
  add column if not exists locale            text not null default 'en',
  add column if not exists total_time        text,
  add column if not exists recipe_yield      text,
  add column if not exists content_markdown  text,
  add column if not exists recipe_category   text,
  add column if not exists recipe_cuisine    text;

-- swaps column was jsonb describing the swap set that produced the variant.
-- Now alternatives live inline on ingredient_lines[].swaps; derived variants
-- are just new rows (different technique = distinct random id).
alter table public.variants drop column if exists swaps;

-- replica identity already full; publication already has variants.

-- Recipes, variants, planned meals, swap suggestions + single list_items partial unique (ADR 6 & 7).
-- Recipes/variants/swap_suggestions are global for alpha/beta (see sync-config.yaml).
-- Before public scale, scope to own + via planned_meals (recipes.created_by + EXISTS).
-- That column is added here so the sync rule can switch without a later table migration.

-- --------------------------------------------------------------------------
-- recipes — global, seeded or user-added
-- --------------------------------------------------------------------------
create table public.recipes (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text,
  locale            text not null default 'en',
  total_time        text,
  recipe_yield      text,
  content_markdown  text,
  recipe_category   text,
  recipe_cuisine    text,
  from_name         text,
  from_url          text,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- variants — a complete cookable version of a recipe.
-- id is deterministic: uuidv5(recipe_id + canonical swaps json) so the same
-- swaps always give the same row. Client generates it; see deterministic
-- helper in apps/mobile/src/db/variants.ts. Stored here as plain uuid pk.
-- ingredient_lines: jsonb array of {qty_text, item_name, prep_note}
-- instructions: full text (LLM rewritten)
-- swaps: jsonb array describing the swap set that produced this variant
--   e.g. [{"from":"bell pepper","to_item":"roasted peppers","to_qty":"1 jar"}]
--   original variant has swaps = '[]'::jsonb
-- --------------------------------------------------------------------------
create table public.variants (
  id                uuid primary key,
  recipe_id         uuid not null references public.recipes (id) on delete cascade,
  ingredient_lines  jsonb not null default '[]'::jsonb, -- array of strings (recipeIngredient) or {qty_text,item_name,prep_note}
  instructions      jsonb not null default '[]'::jsonb, -- array of {name,ingredients,text,tip}
  swaps             jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index variants_recipe_idx on public.variants (recipe_id);
create index variants_recipe_created_idx on public.variants (recipe_id, created_at desc);

-- --------------------------------------------------------------------------
-- swap_suggestions — stored 1:1 alternatives for an ingredient line,
-- generated at recipe import (Gemini Flash) and stored.
-- --------------------------------------------------------------------------
create table public.swap_suggestions (
  id              uuid primary key default gen_random_uuid(),
  recipe_id       uuid not null references public.recipes (id) on delete cascade,
  from_item_name  text not null,
  to_item_name    text not null,
  to_qty_text     text not null,
  created_at      timestamptz not null default now()
);
create index swap_suggestions_recipe_idx on public.swap_suggestions (recipe_id);

-- --------------------------------------------------------------------------
-- planned_meals — recipe + chosen variant placed on a calendar slot.
-- list_id scoping is what RLS and sync check (is_list_member).
-- --------------------------------------------------------------------------
create table public.planned_meals (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists (id) on delete cascade,
  recipe_id   uuid not null references public.recipes (id) on delete cascade,
  variant_id  uuid not null references public.variants (id) on delete restrict,
  slot_date   text not null, -- YYYY-MM-DD
  meal        text not null default 'dinner', -- breakfast/lunch/dinner
  servings    integer not null default 2,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index planned_meals_list_date_idx on public.planned_meals (list_id, slot_date);
create index planned_meals_recipe_idx on public.planned_meals (recipe_id);
create index planned_meals_variant_idx on public.planned_meals (variant_id);

-- --------------------------------------------------------------------------
-- list_items — add meal-derived linkage (ADR 7). Standalone rows keep
-- deterministic uuidv5(list_id, name_key) and dedupe; meal rows use random
-- uuid and allow duplicates.
-- --------------------------------------------------------------------------
alter table public.list_items
  add column planned_meal_id uuid references public.planned_meals (id) on delete cascade,
  add column variant_id uuid references public.variants (id) on delete set null;

create index list_items_planned_meal_idx on public.list_items (planned_meal_id);

-- Replace full unique with partial: only standalone rows dedupe.
alter table public.list_items drop constraint list_items_list_id_name_key_key;
create unique index list_items_standalone_dedupe
  on public.list_items (list_id, name_key) where planned_meal_id is null;

-- --------------------------------------------------------------------------
-- updated_at triggers
-- --------------------------------------------------------------------------
create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create trigger variants_set_updated_at
  before update on public.variants
  for each row execute function public.set_updated_at();

create trigger planned_meals_set_updated_at
  before update on public.planned_meals
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- Row level security
-- --------------------------------------------------------------------------
alter table public.recipes enable row level security;
alter table public.variants enable row level security;
alter table public.swap_suggestions enable row level security;
alter table public.planned_meals enable row level security;

-- Recipes / variants / suggestions: readable by everyone, writable by authenticated.
-- They are global reference data like categories; list membership is not needed
-- to read them (a variant must be visible to anyone who can see the planned
-- meal that points at it — see ADR 4).
create policy "recipes are readable" on public.recipes
  for select to authenticated using (true);
create policy "recipes are writable" on public.recipes
  for insert to authenticated with check (true);
create policy "recipes are updatable" on public.recipes
  for update to authenticated using (true) with check (true);

create policy "variants are readable" on public.variants
  for select to authenticated using (true);
create policy "variants are writable" on public.variants
  for insert to authenticated with check (true);
create policy "variants are updatable" on public.variants
  for update to authenticated using (true) with check (true);

create policy "swap_suggestions are readable" on public.swap_suggestions
  for select to authenticated using (true);
create policy "swap_suggestions are writable" on public.swap_suggestions
  for insert to authenticated with check (true);

create policy "members have full access to planned_meals" on public.planned_meals
  for all to authenticated
  using (public.is_list_member(list_id))
  with check (public.is_list_member(list_id));

-- --------------------------------------------------------------------------
-- Grants (RLS filters rows; grants allow the verb — see initial migration)
-- --------------------------------------------------------------------------
grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.variants to authenticated;
grant select, insert, update, delete on public.swap_suggestions to authenticated;
grant select, insert, update, delete on public.planned_meals to authenticated;

grant select, insert, update, delete
  on public.recipes, public.variants, public.swap_suggestions, public.planned_meals
  to service_role;

-- replica identity for PowerSync incremental sync
alter table public.recipes replica identity full;
alter table public.variants replica identity full;
alter table public.swap_suggestions replica identity full;
alter table public.planned_meals replica identity full;
alter table public.list_items replica identity full;

-- Add new tables to the powersync publication (created in 20260818100100).
-- Must be done after the tables exist — cannot be in the original publication
-- migration that runs before this one.
alter publication powersync add table public.recipes;
alter publication powersync add table public.variants;
alter publication powersync add table public.swap_suggestions;
alter publication powersync add table public.planned_meals;

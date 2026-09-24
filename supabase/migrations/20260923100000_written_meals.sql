-- A meal can be a saved variant or simply what the household plans to eat.
alter table public.planned_meals
  alter column recipe_id drop not null,
  alter column variant_id drop not null,
  add column name text,
  -- Slot ids are deterministic; this identity travels with the meal on a move.
  add column content_id uuid not null default gen_random_uuid(),
  add constraint planned_meals_content check (
    (recipe_id is not null and variant_id is not null and name is null)
    or (recipe_id is null and variant_id is null and name is not null and length(btrim(name)) > 0)
  );

alter table public.chats add column initial_meal_content_id uuid;

-- Existing membership policies, grants and publication cover written meals.

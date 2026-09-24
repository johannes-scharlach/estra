-- Remember that the household reviewed shopping for this recipe version.
-- A new plan/repeat starts unreviewed; a meal move carries this marker.
alter table public.planned_meals
  add column shopping_reviewed_variant_id uuid references public.variants (id) on delete set null;

-- A planned meal records who from the household is eating and how much
-- extra to cook, not a total (ADR 12). The old total never scaled anything,
-- so existing rows reset to everyone in the household with no extra; their
-- servings values are discarded rather than reinterpreted as extra.
alter table public.planned_meals
  drop column servings,
  add column eater_ids jsonb not null default '[]'::jsonb,
  add column extra_portions double precision not null default 0,
  add constraint planned_meals_eater_ids_check check (jsonb_typeof(eater_ids) = 'array'),
  -- Decimal round-trip, as the old servings check did. `< Infinity` also
  -- excludes NaN, which Postgres orders above Infinity.
  add constraint planned_meals_extra_portions_check check (
    extra_portions >= 0
    and extra_portions < 'Infinity'::double precision
    and extra_portions = round(extra_portions::text::numeric, 2)::double precision
  );

update public.planned_meals p
set eater_ids = coalesce(
  (select jsonb_agg(hp.id order by hp.created_at, hp.id)
     from public.household_people hp
    where hp.list_id = p.list_id),
  '[]'::jsonb
);

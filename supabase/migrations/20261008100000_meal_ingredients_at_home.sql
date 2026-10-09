-- ADR 23: a meal records which ingredients the household already has, so an
-- undecided ingredient is distinct from one deliberately not bought.
alter table public.planned_meals add column ingredients_at_home jsonb not null default '[]'::jsonb
  check (jsonb_typeof(ingredients_at_home) = 'array');

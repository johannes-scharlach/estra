alter table public.household_profiles
  add column restrictions text not null default '';

alter table public.household_people
  drop column restrictions;

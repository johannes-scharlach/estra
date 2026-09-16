-- A list is the household. Its identity is also the Profile identity, so
-- concurrent/retried setup converges on one row.
create table public.household_profiles (
  id uuid primary key references public.lists(id) on delete cascade,
  goals jsonb not null default '{}'::jsonb,
  kitchen_equipment jsonb not null default '{}'::jsonb,
  pantry jsonb not null default '{}'::jsonb,
  fresh_ingredients jsonb not null default '{}'::jsonb,
  meals_at_home text not null default 'Dinners.',
  main_supermarket text not null default '',
  other_shops text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(goals) = 'object'),
  check (jsonb_typeof(kitchen_equipment) = 'object'),
  check (jsonb_typeof(pantry) = 'object'),
  check (jsonb_typeof(fresh_ingredients) = 'object')
);

create table public.household_people (
  id uuid primary key,
  list_id uuid not null references public.household_profiles(id) on delete cascade,
  user_id uuid,
  name text not null check (length(trim(name)) > 0),
  age_group text not null default 'Adult'
    check (age_group in ('Adult', 'Teen', 'Child', 'Toddler', 'Infant')),
  diet text not null default 'flexitarian'
    check (diet in ('flexitarian', 'omnivore', 'meat-heavy', 'pescetarian', 'vegetarian', 'vegan', 'other')),
  diet_other text not null default '',
  restrictions text not null default '',
  meal_times text not null default 'Always',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (diet <> 'other' or length(trim(diet_other)) > 0),
  unique (list_id, user_id),
  -- Leaving the list removes access, not the person we cook for.
  foreign key (list_id, user_id) references public.list_members(list_id, user_id)
    on delete set null (user_id)
);

create trigger household_profiles_set_updated_at before update on public.household_profiles
  for each row execute function public.set_updated_at();
create trigger household_people_set_updated_at before update on public.household_people
  for each row execute function public.set_updated_at();

alter table public.household_profiles enable row level security;
alter table public.household_people enable row level security;
create policy "members manage household profiles" on public.household_profiles
  for all to authenticated using (public.is_list_member(id))
  with check (public.is_list_member(id));
create policy "members manage household people" on public.household_people
  for all to authenticated using (public.is_list_member(list_id))
  with check (public.is_list_member(list_id));
grant select, insert, update, delete on public.household_profiles, public.household_people
  to authenticated, service_role;
alter table public.household_profiles replica identity full;
alter table public.household_people replica identity full;
alter publication powersync add table public.household_profiles, public.household_people;

-- Meal-planning activity (spec 0008). Snapshots keep history readable after
-- the meal changes again.
alter table public.household_activities
  add column if not exists meal_name text,
  add column if not exists slot_date text,
  add column if not exists meal text,
  add column if not exists previous_meal_name text,
  add column if not exists previous_slot_date text,
  add column if not exists previous_meal text;
alter table public.household_activities
  drop constraint if exists household_activities_kind_check,
  add constraint household_activities_kind_check
    check (kind in ('member_joined', 'meal_planned', 'meal_changed', 'meal_replaced', 'meal_moved', 'meal_removed'));

-- A written meal has its own name; a recipe meal is named by its variant,
-- which can still be unnamed while an import finishes.
create or replace function public.planned_meal_name(meal public.planned_meals)
returns text language sql stable set search_path = '' as $$
  select coalesce(meal.name, (select v.name from public.variants v where v.id = meal.variant_id), 'A meal');
$$;
revoke all on function public.planned_meal_name(public.planned_meals) from public, anon, authenticated;

create index if not exists planned_meals_content_idx
  on public.planned_meals (list_id, content_id);

create or replace function public.record_meal_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_name text;
  meal_row public.planned_meals;
  kind text;
  previous_name text;
  origin public.planned_meals;
  activity uuid;
begin
  -- Only members' own writes are news; seeds and maintenance are not.
  if actor is null then
    return null;
  end if;
  -- Uploads arrive op by op. A move inserts the destination while the source
  -- still holds the same content_id, then deletes the source (ADR 21).
  if tg_op = 'INSERT' then
    meal_row := new;
    select * into origin from public.planned_meals p
      where p.list_id = new.list_id and p.content_id = new.content_id and p.id <> new.id;
    kind := case when origin.id is null then 'meal_planned' else 'meal_moved' end;
  elsif tg_op = 'DELETE' then
    if exists (select 1 from public.planned_meals p
               where p.list_id = old.list_id and p.content_id = old.content_id) then
      return null;
    end if;
    meal_row := old;
    kind := 'meal_removed';
  elsif new.content_id <> old.content_id then
    -- Either half of a swap: one of the two meals is also in another slot.
    if exists (select 1 from public.planned_meals p
               where p.list_id = new.list_id and p.id <> new.id
                 and p.content_id in (new.content_id, old.content_id)) then
      return null;
    end if;
    meal_row := new;
    kind := 'meal_replaced';
    previous_name := public.planned_meal_name(old);
  elsif new.variant_id is distinct from old.variant_id or new.name is distinct from old.name then
    -- A chat edit or Adjust repoints the variant; a written meal is renamed.
    meal_row := new;
    kind := 'meal_changed';
    previous_name := public.planned_meal_name(old);
  else
    return null;
  end if;

  select p.name into actor_name from public.household_people p
    where p.list_id = meal_row.list_id and p.user_id = actor;
  insert into public.household_activities
      (list_id, kind, actor_user_id, actor_name, meal_name, slot_date, meal,
       previous_meal_name, previous_slot_date, previous_meal)
    values (meal_row.list_id, kind, actor, coalesce(actor_name, 'Someone'),
      public.planned_meal_name(meal_row), meal_row.slot_date, meal_row.meal,
      previous_name, origin.slot_date, origin.meal)
    returning id into activity;
  insert into public.household_activity_recipients (activity_id, list_id, user_id)
    select activity, meal_row.list_id, m.user_id from public.list_members m
    where m.list_id = meal_row.list_id and m.user_id <> actor;
  return null;
-- A missed activity must never cost the meal: uploads drop writes that fail
-- with constraint errors (connector.ts), so log and let the write through.
exception when others then
  raise warning 'meal activity skipped: % (%)', sqlerrm, sqlstate;
  return null;
end;
$$;

drop trigger if exists planned_meals_record_activity on public.planned_meals;
create trigger planned_meals_record_activity
  after insert or update or delete on public.planned_meals
  for each row execute function public.record_meal_activity();

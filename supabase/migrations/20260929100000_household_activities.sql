-- Activities are facts; recipient state is personal, and delivery comes later.
create table public.household_activities (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  kind text not null check (kind in ('member_joined')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  occurred_at timestamptz not null default now(),
  unique (id, list_id)
);
create index household_activities_recent_idx
  on public.household_activities (list_id, occurred_at desc, id desc);

create table public.household_activity_recipients (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  -- Denormalized for membership-based RLS and sync. The FK keeps it honest.
  list_id uuid not null,
  user_id uuid not null,
  seen_at timestamptz,
  unique (activity_id, user_id),
  foreign key (activity_id, list_id) references public.household_activities(id, list_id)
    on delete cascade,
  foreign key (list_id, user_id) references public.list_members(list_id, user_id)
    on delete cascade
);
create index household_activity_recipients_user_idx
  on public.household_activity_recipients (user_id, list_id);

alter table public.household_activities enable row level security;
alter table public.household_activity_recipients enable row level security;
create policy "members read household activities" on public.household_activities
  for select to authenticated using (public.is_list_member(list_id));
create policy "recipients read their activity state" on public.household_activity_recipients
  for select to authenticated using (user_id = auth.uid() and public.is_list_member(list_id));
create policy "recipients mark their activities seen" on public.household_activity_recipients
  for update to authenticated using (user_id = auth.uid() and public.is_list_member(list_id))
  with check (user_id = auth.uid() and public.is_list_member(list_id));

revoke all on public.household_activities, public.household_activity_recipients
  from public, anon, authenticated;
grant select on public.household_activities, public.household_activity_recipients to authenticated;
grant update (seen_at) on public.household_activity_recipients to authenticated;
grant all on public.household_activities, public.household_activity_recipients to service_role;

-- Offline devices can report the same observation later. Seen never becomes
-- unseen, and retries preserve the timestamp already accepted by the server.
create function public.preserve_activity_seen_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.seen_at := coalesce(old.seen_at, new.seen_at);
  return new;
end;
$$;
create trigger household_activity_recipients_preserve_seen
  before update on public.household_activity_recipients
  for each row execute function public.preserve_activity_seen_at();

alter table public.household_activities replica identity full;
alter table public.household_activity_recipients replica identity full;
alter publication powersync add table public.household_activities, public.household_activity_recipients;

create or replace function public.accept_household_invite(code text, person_id uuid default null, person_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  claimed uuid;
  caller uuid := auth.uid();
  new_membership uuid;
  joined_name text;
  activity uuid;
begin
  if caller is null then
    raise sqlstate '42501' using message = 'Sign in to join a household.';
  end if;
  -- Serialize acceptance and resets, including two requests by the same user.
  select l.id into target from public.lists l
    join public.household_profiles p on p.id = l.id
    where l.invite_code = code for update of l;
  if not found then
    raise sqlstate 'PT404' using message = 'This invitation is no longer valid. Ask for a new link.';
  end if;
  if exists (select 1 from public.household_people where list_id = target and user_id = caller) then
    return target;
  end if;
  if (person_id is null) = (nullif(btrim(person_name), '') is null) then
    raise sqlstate 'PT400' using message = 'Choose yourself or enter your name.';
  end if;
  insert into public.list_members (list_id, user_id) values (target, caller)
    on conflict (list_id, user_id) do nothing returning id into new_membership;
  if person_id is not null then
    update public.household_people set user_id = caller
      where id = person_id and list_id = target and user_id is null
      returning id, name into claimed, joined_name;
    if claimed is null then
      -- Membership, activity and recipients all roll back with a failed claim.
      raise sqlstate 'PT409' using message = 'That person is no longer available. Please choose again.';
    end if;
  else
    insert into public.household_people (id, list_id, user_id, name, meal_times)
      values (gen_random_uuid(), target, caller, btrim(person_name), 'All meals')
      returning name into joined_name;
  end if;

  -- Linking a person for an existing member isn't a new join.
  if new_membership is not null then
    insert into public.household_activities (list_id, kind, actor_user_id, actor_name)
      values (target, 'member_joined', caller, joined_name) returning id into activity;
    insert into public.household_activity_recipients (activity_id, list_id, user_id)
      select activity, target, user_id from public.list_members
      where list_id = target and user_id <> caller;
  end if;
  return target;
end;
$$;

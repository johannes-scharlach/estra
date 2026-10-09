-- List activity (spec 0009, ADR 24). One person's adds or check-offs group
-- into one open activity; its push waits until a quiet window passes.
alter table public.household_activities
  add column if not exists item_names jsonb,
  add column if not exists closes_at timestamptz;
alter table public.household_activities
  drop constraint if exists household_activities_kind_check,
  add constraint household_activities_kind_check
    check (kind in ('member_joined', 'meal_planned', 'meal_changed', 'meal_replaced',
                    'meal_moved', 'meal_removed', 'items_added', 'items_bought'));
create index if not exists household_activities_open_idx
  on public.household_activities (list_id, actor_user_id, kind, closes_at)
  where closes_at is not null;

-- Appends a name to the actor's open activity of this kind, or starts one,
-- and moves the push to the end of the new quiet window.
create or replace function public.extend_list_activity(
  target_list_id uuid, actor uuid, target_kind text, item_name text, quiet interval
) returns void language plpgsql security definer set search_path = '' as $$
declare
  activity uuid;
  actor_name text;
  closes timestamptz := now() + quiet;
begin
  update public.household_activities a set
    item_names = case when a.item_names ? item_name then a.item_names
                      else a.item_names || jsonb_build_array(item_name) end,
    closes_at = closes
  where a.list_id = target_list_id and a.actor_user_id = actor
    and a.kind = target_kind and a.closes_at > now()
  returning a.id into activity;

  if activity is null then
    select p.name into actor_name from public.household_people p
      where p.list_id = target_list_id and p.user_id = actor;
    insert into public.household_activities
        (list_id, kind, actor_user_id, actor_name, item_names, closes_at)
      values (target_list_id, target_kind, actor, coalesce(actor_name, 'Someone'),
        jsonb_build_array(item_name), closes)
      returning id into activity;
    insert into public.household_activity_recipients (activity_id, list_id, user_id)
      select activity, target_list_id, m.user_id from public.list_members m
      where m.list_id = target_list_id and m.user_id <> actor;
    insert into public.notification_deliveries (
      activity_id, recipient_id, list_id, user_id, device_id, next_attempt_at
    )
      select activity, r.id, target_list_id, r.user_id, p.id, closes
      from public.household_activity_recipients r
      join public.push_devices p on p.user_id = r.user_id and p.disabled_at is null
      where r.activity_id = activity;
  else
    update public.notification_deliveries d set next_attempt_at = closes, updated_at = now()
      where d.activity_id = activity and d.status = 'pending';
  end if;
end;
$$;
revoke all on function public.extend_list_activity(uuid, uuid, text, text, interval)
  from public, anon, authenticated;

-- Takes a name back out of the actor's open activity: an undo, not news. An
-- emptied activity goes with its recipients and pending pushes. Returns
-- whether there was anything to take back.
create or replace function public.retract_list_activity(
  target_list_id uuid, actor uuid, target_kind text, item_name text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  activity uuid;
begin
  update public.household_activities a set item_names = a.item_names - item_name
  where a.list_id = target_list_id and a.actor_user_id = actor
    and a.kind = target_kind and a.closes_at > now() and a.item_names ? item_name
  returning a.id into activity;
  delete from public.household_activities a
    where a.id = activity and a.item_names = '[]'::jsonb;
  return activity is not null;
end;
$$;
revoke all on function public.retract_list_activity(uuid, uuid, text, text)
  from public, anon, authenticated;

create or replace function public.record_list_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
begin
  -- Only members' own writes are news; seeds and maintenance are not.
  if actor is null then
    return null;
  end if;
  if tg_op = 'INSERT' and new.status = 'active' then
    perform public.extend_list_activity(new.list_id, actor, 'items_added', new.name, '5 minutes');
  elsif tg_op = 'DELETE' and old.status = 'active' then
    perform public.retract_list_activity(old.list_id, actor, 'items_added', old.name);
  elsif tg_op = 'UPDATE' and old.status = 'purchased' and new.status = 'active' then
    -- Unticking a fresh check-off is an undo; otherwise it's re-added from recent.
    if not public.retract_list_activity(new.list_id, actor, 'items_bought', new.name) then
      perform public.extend_list_activity(new.list_id, actor, 'items_added', new.name, '5 minutes');
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'active' and new.status = 'purchased' then
    perform public.extend_list_activity(new.list_id, actor, 'items_bought', new.name, '15 minutes');
  end if;
  return null;
-- A missed activity must never cost the item: uploads drop writes that fail
-- with constraint errors (connector.ts), so log and let the write through.
exception when others then
  raise warning 'list activity skipped: % (%)', sqlerrm, sqlstate;
  return null;
end;
$$;

create trigger list_items_record_activity
  after insert or update or delete on public.list_items
  for each row execute function public.record_list_activity();

-- A push lands within a minute of its quiet window closing (ADR 24).
select cron.schedule(
  'dispatch-notification-deliveries',
  '* * * * *',
  $job$
    select public.request_notification_dispatch()
    where exists (
      select 1 from public.notification_deliveries
      where (status in ('pending', 'retry') and next_attempt_at <= now())
         or (status = 'ticketed' and receipt_due_at <= now())
    );
  $job$
);

-- The worker writes list pushes from item_names. A new return type needs drop
-- and create; the body is unchanged from 20261006120000.
drop function if exists public.claim_notification_deliveries(uuid, integer, integer);
create or replace function public.claim_notification_deliveries(
  claim_id uuid,
  batch_size integer default 100,
  lease_seconds integer default 60
) returns table (
  id uuid,
  activity_id uuid,
  list_id uuid,
  user_id uuid,
  device_id uuid,
  expo_push_token text,
  status text,
  attempt_count integer,
  expo_ticket_id text,
  ticket_sent_at timestamptz,
  time_zone text,
  household_name text,
  kind text,
  actor_name text,
  meal_name text,
  slot_date text,
  meal text,
  previous_meal_name text,
  previous_slot_date text,
  previous_meal text,
  item_names jsonb
) language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then
    raise sqlstate '42501' using message = 'Service role required.';
  end if;

  -- Leaving the household, signing out, or reassigning this installation
  -- makes an unsent push useless or unsafe.
  update public.notification_deliveries d set
    status = 'cancelled',
    lease_id = null,
    lease_until = null,
    last_error = 'no_longer_eligible',
    updated_at = now()
  from public.household_activity_recipients r, public.push_devices p
  where d.recipient_id = r.id
    and d.device_id = p.id
    and d.status in ('pending', 'retry')
    and (d.lease_until is null or d.lease_until < now())
    and (
      p.disabled_at is not null
      or p.user_id <> d.user_id
      or not exists (
        select 1 from public.list_members m
        where m.list_id = d.list_id and m.user_id = d.user_id
      )
    );

  -- A seen activity also cancels before its retry becomes due.
  update public.notification_deliveries d set
    status = 'cancelled',
    lease_id = null,
    lease_until = null,
    last_error = 'already_seen',
    updated_at = now()
  from public.household_activity_recipients r
  where d.recipient_id = r.id
    and d.status in ('pending', 'retry')
    and (d.lease_until is null or d.lease_until < now())
    and r.seen_at is not null;

  -- A lease can expire after Expo accepted a ticket but before the result was
  -- persisted. Retrying is preferable to silently dropping the notification;
  -- duplicates remain possible under that unavoidable crash window.

  return query
  with candidates as (
    select d.id
    from public.notification_deliveries d
    where (d.lease_until is null or d.lease_until < now())
      and (
        (d.status in ('pending', 'retry') and d.next_attempt_at <= now())
        or (d.status = 'ticketed' and d.receipt_due_at <= now())
      )
    order by coalesce(d.receipt_due_at, d.next_attempt_at), d.created_at, d.id
    for update skip locked
    limit least(greatest(batch_size, 1), 100)
  ), claimed as (
    update public.notification_deliveries d set
      lease_id = claim_notification_deliveries.claim_id,
      lease_until = now() + make_interval(secs => least(greatest(lease_seconds, 15), 300)),
      updated_at = now()
    from candidates c
    where d.id = c.id
    returning d.*
  )
  select c.id, c.activity_id, c.list_id, c.user_id, c.device_id,
    p.expo_push_token, c.status, c.attempt_count, c.expo_ticket_id,
    c.ticket_sent_at, p.time_zone, l.name, a.kind, a.actor_name, a.meal_name,
    a.slot_date, a.meal, a.previous_meal_name, a.previous_slot_date, a.previous_meal,
    a.item_names
  from claimed c
  join public.push_devices p on p.id = c.device_id
  join public.household_activities a on a.id = c.activity_id
  join public.lists l on l.id = c.list_id;
end;
$$;
revoke all on function public.claim_notification_deliveries(uuid, integer, integer) from public;
grant execute on function public.claim_notification_deliveries(uuid, integer, integer) to service_role;

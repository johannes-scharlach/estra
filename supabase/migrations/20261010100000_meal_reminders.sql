-- Meal reminders (spec 0010, ADR 25): 8:00 in each device's time zone, for
-- every member, whether the day is planned or still empty.

-- An empty day is worth a nudge on the two days after the last planned one,
-- then on the first day of the household's usual block: Monday for weekday
-- cooks, Saturday for weekend cooks. A household that never planned hears
-- Mondays.
create or replace function public.empty_day_reminder_due(day date, last_planned date)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when last_planned is null then extract(isodow from day) = 1
    when day - last_planned <= 2 then true
    when extract(isodow from last_planned) >= 6 then extract(isodow from day) = 6
    else extract(isodow from day) = 1
  end;
$$;
revoke all on function public.empty_day_reminder_due(date, date) from public, anon, authenticated;

-- A reminder is a delivery about a day, not about something someone did: it
-- has no activity, recipient or seen state, and never enters the feed.
alter table public.notification_deliveries
  alter column activity_id drop not null,
  alter column recipient_id drop not null,
  add column if not exists reminder_date date,
  add constraint notification_deliveries_subject_check check (
    (activity_id is not null and recipient_id is not null and reminder_date is null)
    or (activity_id is null and recipient_id is null and reminder_date is not null)
  );
create unique index if not exists notification_deliveries_reminder_idx
  on public.notification_deliveries (device_id, list_id, reminder_date)
  where reminder_date is not null;

-- Queues one reminder per device and household between 8:00 and 9:00 local
-- time; the hour covers missed cron runs, the index makes reruns no-ops.
-- Devices without a known time zone get none: guessing their 8:00 is worse.
create or replace function public.queue_meal_reminders(now_at timestamptz default now())
returns void language sql security definer set search_path = '' as $$
  with devices as materialized (
    select p.id, p.user_id, p.time_zone from public.push_devices p
    where p.disabled_at is null
      and p.time_zone in (select z.name from pg_catalog.pg_timezone_names z)
  ), due as (
    select d.id, d.user_id, (now_at at time zone d.time_zone) local_at from devices d
  )
  insert into public.notification_deliveries (list_id, user_id, device_id, reminder_date)
  select m.list_id, d.user_id, d.id, d.local_at::date
  from due d
  join public.list_members m on m.user_id = d.user_id
  where d.local_at::time >= '08:00' and d.local_at::time < '09:00'
    and (
      exists (select 1 from public.planned_meals pm
              where pm.list_id = m.list_id and pm.slot_date = d.local_at::date::text)
      or public.empty_day_reminder_due(d.local_at::date,
           (select max(pm.slot_date)::date from public.planned_meals pm
            where pm.list_id = m.list_id and pm.slot_date < d.local_at::date::text))
    )
  on conflict (device_id, list_id, reminder_date) where reminder_date is not null do nothing;
$$;
revoke all on function public.queue_meal_reminders(timestamptz) from public, anon, authenticated;

select cron.schedule(
  'dispatch-notification-deliveries',
  '* * * * *',
  $job$
    select public.queue_meal_reminders();
    select public.request_notification_dispatch()
    where exists (
      select 1 from public.notification_deliveries
      where (status in ('pending', 'retry') and next_attempt_at <= now())
         or (status = 'ticketed' and receipt_due_at <= now())
    );
  $job$
);

-- Reminders are written from the day as it is at send time: its meals in slot
-- order and how many of their items are still on the List. Eligibility no
-- longer needs a recipient row. A new return type needs drop and create.
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
  item_names jsonb,
  day_meals jsonb,
  items_to_buy integer
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
  from public.push_devices p
  where d.device_id = p.id
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
    c.ticket_sent_at, p.time_zone, l.name, coalesce(a.kind, 'meal_reminder'),
    a.actor_name, a.meal_name, coalesce(a.slot_date, c.reminder_date::text), a.meal,
    a.previous_meal_name, a.previous_slot_date, a.previous_meal, a.item_names,
    day.meals, day.items_to_buy
  from claimed c
  join public.push_devices p on p.id = c.device_id
  join public.lists l on l.id = c.list_id
  left join public.household_activities a on a.id = c.activity_id
  left join lateral (
    select
      coalesce(jsonb_agg(
        jsonb_build_object('meal', pm.meal, 'name', public.planned_meal_name(pm))
        order by array_position(array['breakfast', 'lunch', 'dinner'], pm.meal), pm.created_at
      ), '[]'::jsonb) meals,
      (select count(*)::integer from public.list_items i
        where i.status = 'active' and i.planned_meal_id = any(array_agg(pm.id))) items_to_buy
    from public.planned_meals pm
    where pm.list_id = c.list_id and pm.slot_date = c.reminder_date::text
  ) day on c.reminder_date is not null;
end;
$$;
revoke all on function public.claim_notification_deliveries(uuid, integer, integer) from public;
grant execute on function public.claim_notification_deliveries(uuid, integer, integer) to service_role;

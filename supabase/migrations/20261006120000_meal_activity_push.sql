-- Meal activity push (spec 0008, slice 2): deliveries for recipients' active
-- devices, in the same transaction, as accept_household_invite does for joins.
--
-- Uploads reach Postgres without an Edge Function, so the trigger requests the
-- worker itself. pg_net sends only after commit; cron stays the recovery path.

-- Hosted setup: Vault secrets notification_worker_url and
-- notification_worker_secret (spec 0007). Without them this does nothing.
create or replace function public.request_notification_dispatch()
returns void language sql security definer set search_path = '' as $$
  select net.http_post(
    url := url.decrypted_secret,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-secret', secret.decrypted_secret
    ),
    body := '{}'::jsonb
  )
  from vault.decrypted_secrets url, vault.decrypted_secrets secret
  where url.name = 'notification_worker_url'
    and secret.name = 'notification_worker_secret';
$$;
revoke all on function public.request_notification_dispatch() from public, anon, authenticated;

select cron.schedule(
  'dispatch-notification-deliveries',
  '*/5 * * * *',
  $job$
    select public.request_notification_dispatch()
    where exists (
      select 1 from public.notification_deliveries
      where (status in ('pending', 'retry') and next_attempt_at <= now())
         or (status = 'ticketed' and receipt_due_at <= now())
    );
  $job$
);

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
  insert into public.notification_deliveries (
    activity_id, recipient_id, list_id, user_id, device_id
  )
    select activity, r.id, meal_row.list_id, r.user_id, p.id
    from public.household_activity_recipients r
    join public.push_devices p on p.user_id = r.user_id and p.disabled_at is null
    where r.activity_id = activity;
  if found then
    perform public.request_notification_dispatch();
  end if;
  return null;
-- A missed activity must never cost the meal: uploads drop writes that fail
-- with constraint errors (connector.ts), so log and let the write through.
exception when others then
  raise warning 'meal activity skipped: % (%)', sqlerrm, sqlstate;
  return null;
end;
$$;

-- "Today" and "tomorrow" in push text need the recipient's time zone (IANA
-- name). Builds that don't send one get weekdays only.
alter table public.push_devices add column if not exists time_zone text;
drop function if exists public.register_push_device(uuid, text, text);
create or replace function public.register_push_device(
  target_installation_id uuid,
  target_expo_push_token text,
  target_platform text,
  target_time_zone text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  device_id uuid;
begin
  if caller is null then
    raise sqlstate '42501' using message = 'Sign in to enable notifications.';
  end if;
  if target_platform not in ('ios', 'android') then
    raise sqlstate '22023' using message = 'Unsupported push platform.';
  end if;
  if target_expo_push_token !~ '^Expo(nent)?PushToken\[[^]]+\]$' then
    raise sqlstate '22023' using message = 'Invalid Expo push token.';
  end if;

  -- A reinstall can produce a new installation id for an existing token.
  -- Keep the old row for delivery history, but make only one row active.
  update public.push_devices
    set disabled_at = now(), disabled_reason = 'token_reassigned'
    where expo_push_token = target_expo_push_token
      and installation_id <> target_installation_id
      and disabled_at is null;

  insert into public.push_devices (
    installation_id, user_id, expo_push_token, platform, time_zone
  ) values (
    target_installation_id, caller, target_expo_push_token, target_platform, target_time_zone
  )
  on conflict (installation_id) do update set
    user_id = excluded.user_id,
    expo_push_token = excluded.expo_push_token,
    platform = excluded.platform,
    time_zone = excluded.time_zone,
    registered_at = now(),
    disabled_at = null,
    disabled_reason = null
  returning id into device_id;
  return device_id;
end;
$$;
revoke all on function public.register_push_device(uuid, text, text, text) from public;
grant execute on function public.register_push_device(uuid, text, text, text)
  to authenticated, service_role;

-- The worker writes meal pushes from the activity snapshot, in the device's
-- time zone. A new return type needs drop and create.
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
  previous_meal text
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
    a.slot_date, a.meal, a.previous_meal_name, a.previous_slot_date, a.previous_meal
  from claimed c
  join public.push_devices p on p.id = c.device_id
  join public.household_activities a on a.id = c.activity_id
  join public.lists l on l.id = c.list_id;
end;
$$;
revoke all on function public.claim_notification_deliveries(uuid, integer, integer) from public;
grant execute on function public.claim_notification_deliveries(uuid, integer, integer) to service_role;

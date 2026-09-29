-- Push tokens are private server-side data. Clients manage only their own
-- installation through the narrow security-definer functions below.
create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  registered_at timestamptz not null default now(),
  disabled_at timestamptz,
  disabled_reason text
);
create unique index push_devices_active_token_idx
  on public.push_devices (expo_push_token) where disabled_at is null;
create index push_devices_user_idx
  on public.push_devices (user_id) where disabled_at is null;

alter table public.push_devices enable row level security;
revoke all on public.push_devices from public, anon, authenticated;
grant all on public.push_devices to service_role;

create function public.register_push_device(
  target_installation_id uuid,
  target_expo_push_token text,
  target_platform text
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
    installation_id, user_id, expo_push_token, platform
  ) values (
    target_installation_id, caller, target_expo_push_token, target_platform
  )
  on conflict (installation_id) do update set
    user_id = excluded.user_id,
    expo_push_token = excluded.expo_push_token,
    platform = excluded.platform,
    registered_at = now(),
    disabled_at = null,
    disabled_reason = null
  returning id into device_id;
  return device_id;
end;
$$;

create function public.unregister_push_device(target_installation_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.push_devices
    set disabled_at = now(), disabled_reason = 'signed_out'
    where installation_id = target_installation_id
      and user_id = auth.uid()
      and disabled_at is null;
$$;

revoke all on function public.register_push_device(uuid, text, text) from public;
revoke all on function public.unregister_push_device(uuid) from public;
grant execute on function public.register_push_device(uuid, text, text) to authenticated;
grant execute on function public.unregister_push_device(uuid) to authenticated;
grant execute on function public.register_push_device(uuid, text, text) to service_role;
grant execute on function public.unregister_push_device(uuid) to service_role;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.household_activities(id) on delete cascade,
  recipient_id uuid not null references public.household_activity_recipients(id) on delete cascade,
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.push_devices(id),
  status text not null default 'pending'
    check (status in ('pending', 'retry', 'ticketed', 'delivered', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  expo_ticket_id text,
  ticket_sent_at timestamptz,
  receipt_due_at timestamptz,
  lease_id uuid,
  lease_until timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, device_id)
);
create index notification_deliveries_push_due_idx
  on public.notification_deliveries (next_attempt_at)
  where status in ('pending', 'retry');
create index notification_deliveries_receipt_due_idx
  on public.notification_deliveries (receipt_due_at)
  where status = 'ticketed';
create index notification_deliveries_recipient_idx
  on public.notification_deliveries (recipient_id)
  where status in ('pending', 'retry');
create index notification_deliveries_device_idx
  on public.notification_deliveries (device_id)
  where status in ('pending', 'retry');

alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from public, anon, authenticated;
grant all on public.notification_deliveries to service_role;

-- Claims remain valid only for a short lease. A crashed worker therefore
-- cannot strand work, and immediate dispatch can safely overlap cron recovery.
create function public.claim_notification_deliveries(
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
  actor_name text,
  household_name text
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
    c.ticket_sent_at, a.actor_name, l.name
  from claimed c
  join public.push_devices p on p.id = c.device_id
  join public.household_activities a on a.id = c.activity_id
  join public.lists l on l.id = c.list_id;
end;
$$;
revoke all on function public.claim_notification_deliveries(uuid, integer, integer) from public;
grant execute on function public.claim_notification_deliveries(uuid, integer, integer) to service_role;

-- Add delivery work in the same transaction as membership, activity, and
-- recipient state. A delivery exists only for devices active at join time.
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
      raise sqlstate 'PT409' using message = 'That person is no longer available. Please choose again.';
    end if;
  else
    insert into public.household_people (id, list_id, user_id, name, meal_times)
      values (gen_random_uuid(), target, caller, btrim(person_name), 'All meals')
      returning name into joined_name;
  end if;

  if new_membership is not null then
    insert into public.household_activities (list_id, kind, actor_user_id, actor_name)
      values (target, 'member_joined', caller, joined_name) returning id into activity;
    insert into public.household_activity_recipients (activity_id, list_id, user_id)
      select activity, target, user_id from public.list_members
      where list_id = target and user_id <> caller;
    insert into public.notification_deliveries (
      activity_id, recipient_id, list_id, user_id, device_id
    )
      select activity, r.id, target, r.user_id, p.id
      from public.household_activity_recipients r
      join public.push_devices p on p.user_id = r.user_id and p.disabled_at is null
      where r.activity_id = activity;
  end if;
  return target;
end;
$$;

-- Hosted setup: add notification_worker_url and notification_worker_secret
-- to Vault. Without them the five-minute job is inert and incurs no request.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule(
  'dispatch-notification-deliveries',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'notification_worker_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-notification-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'notification_worker_secret')
      ),
      body := '{}'::jsonb
    )
    where exists (
      select 1 from public.notification_deliveries
      where (status in ('pending', 'retry') and next_attempt_at <= now())
         or (status = 'ticketed' and receipt_due_at <= now())
    )
      and exists (select 1 from vault.decrypted_secrets where name = 'notification_worker_url')
      and exists (select 1 from vault.decrypted_secrets where name = 'notification_worker_secret');
  $job$
);

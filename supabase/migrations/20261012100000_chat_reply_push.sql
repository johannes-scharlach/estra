-- Chat reply push (ADR 26): when the app left before a reply finished, the
-- user who asked hears that it is ready.

alter table public.notification_deliveries
  add column if not exists chat_message_id uuid
    references public.chat_messages (id) on delete cascade,
  drop constraint notification_deliveries_subject_check,
  add constraint notification_deliveries_subject_check check (
    (activity_id is not null and recipient_id is not null
      and reminder_date is null and chat_message_id is null)
    or (activity_id is null and recipient_id is null
      and reminder_date is not null and chat_message_id is null)
    or (activity_id is null and recipient_id is null
      and reminder_date is null and chat_message_id is not null)
  );
create unique index if not exists notification_deliveries_chat_message_idx
  on public.notification_deliveries (device_id, chat_message_id)
  where chat_message_id is not null;

-- Called by the API after it saved the final reply. Only the asker's active
-- devices hear; the household shares the chat but did not wait for it.
create or replace function public.queue_chat_reply(message_id uuid, asker_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_deliveries (list_id, user_id, device_id, chat_message_id)
  select cm.list_id, p.user_id, p.id, cm.id
  from public.chat_messages cm
  join public.push_devices p on p.user_id = asker_id and p.disabled_at is null
  where cm.id = message_id
  on conflict (device_id, chat_message_id) where chat_message_id is not null do nothing;
  perform public.request_notification_dispatch();
end;
$$;
revoke all on function public.queue_chat_reply(uuid, uuid) from public, anon, authenticated;

-- The reply is read at send time; only its text and turn state, since tool
-- output can be large and never reaches the push. A new return type needs
-- drop and create.
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
  items_to_buy integer,
  chat_id uuid,
  chat_title text,
  reply_parts jsonb
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
    c.ticket_sent_at, p.time_zone, l.name,
    coalesce(a.kind, case when c.chat_message_id is not null then 'chat_reply' else 'meal_reminder' end),
    a.actor_name, a.meal_name, coalesce(a.slot_date, c.reminder_date::text), a.meal,
    a.previous_meal_name, a.previous_slot_date, a.previous_meal, a.item_names,
    day.meals, day.items_to_buy,
    cm.chat_id, ch.title,
    jsonb_path_query_array(cm.parts, '$[*] ? (@.type == "text" || @.type == "data-turn")')
  from claimed c
  join public.push_devices p on p.id = c.device_id
  join public.lists l on l.id = c.list_id
  left join public.household_activities a on a.id = c.activity_id
  left join public.chat_messages cm on cm.id = c.chat_message_id
  left join public.chats ch on ch.id = cm.chat_id
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

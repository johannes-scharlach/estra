begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

-- An empty day after the last planned one (spec 0010): the next two days,
-- then the first day of the household's usual block, Monday or Saturday.
-- 2026-10-09 is a Friday.
select results_eq(
  $$select day, empty_day_reminder_due(day::date, last_planned::date)
    from (values
      ('2026-10-10', '2026-10-09'), ('2026-10-11', '2026-10-09'),
      ('2026-10-12', '2026-10-09'), ('2026-10-13', '2026-10-09'),
      ('2026-10-19', '2026-10-09'),
      ('2026-10-13', '2026-10-11'), ('2026-10-14', '2026-10-11'),
      ('2026-10-17', '2026-10-11'), ('2026-10-18', '2026-10-11'),
      ('2026-10-12', null), ('2026-10-13', null)
    ) cases (day, last_planned)$$,
  $$values
    ('2026-10-10', true), ('2026-10-11', true), ('2026-10-12', true), ('2026-10-13', false),
    ('2026-10-19', true),
    ('2026-10-13', true), ('2026-10-14', false), ('2026-10-17', true), ('2026-10-18', false),
    ('2026-10-12', true), ('2026-10-13', false)$$,
  'Weekday cooks hear Monday, weekend cooks Saturday, after two days of reminders');

-- Anna and Ben in Berlin (UTC+2 in October). Ben's old build sent no time
-- zone; Anna's tablet sent one Postgres doesn't know. Monday has dinner and
-- lunch; two of Lasagne's items are still to buy.
insert into auth.users (id) values
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002');
insert into public.lists (id, name, created_by) values
  ('b1000000-0000-4000-8000-000000000001', 'Family', 'a1000000-0000-4000-8000-000000000001');
insert into public.list_members (list_id, user_id) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002');
insert into public.push_devices (id, installation_id, user_id, expo_push_token, platform, time_zone) values
  ('a2000000-0000-4000-8000-000000000001', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000001', 'ExpoPushToken[anna]', 'ios', 'Europe/Berlin'),
  ('a2000000-0000-4000-8000-000000000002', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000002', 'ExpoPushToken[ben]', 'ios', 'Europe/Berlin'),
  ('a2000000-0000-4000-8000-000000000003', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000002', 'ExpoPushToken[ben-old]', 'android', null),
  ('a2000000-0000-4000-8000-000000000004', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000001', 'ExpoPushToken[anna-tablet]', 'ios', 'Mars/Phobos');
insert into public.planned_meals (id, list_id, name, content_id, slot_date, meal) values
  ('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Lasagne',
   'e1000000-0000-4000-8000-000000000001', '2026-10-12', 'dinner'),
  ('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'Soup',
   'e1000000-0000-4000-8000-000000000002', '2026-10-12', 'lunch');
insert into public.list_items (id, list_id, name, name_key, planned_meal_id, status) values
  (gen_random_uuid(), 'b1000000-0000-4000-8000-000000000001', 'Mince', 'mince',
   'd1000000-0000-4000-8000-000000000001', 'active'),
  (gen_random_uuid(), 'b1000000-0000-4000-8000-000000000001', 'Pasta sheets', 'pasta sheets',
   'd1000000-0000-4000-8000-000000000001', 'active'),
  (gen_random_uuid(), 'b1000000-0000-4000-8000-000000000001', 'Tomatoes', 'tomatoes',
   'd1000000-0000-4000-8000-000000000001', 'purchased'),
  (gen_random_uuid(), 'b1000000-0000-4000-8000-000000000001', 'Milk', 'milk', null, 'active');

select queue_meal_reminders('2026-10-12 05:59Z');
select queue_meal_reminders('2026-10-12 06:05Z');
select queue_meal_reminders('2026-10-12 06:40Z');
select results_eq(
  $$select device_id, reminder_date from notification_deliveries
    where list_id = 'b1000000-0000-4000-8000-000000000001' order by device_id$$,
  $$values ('a2000000-0000-4000-8000-000000000001'::uuid, '2026-10-12'::date),
           ('a2000000-0000-4000-8000-000000000002'::uuid, '2026-10-12'::date)$$,
  'Each device with a known time zone gets one reminder from 8:00');

-- Wednesday (two days on) is still nudged; Thursday waits for Monday.
select queue_meal_reminders('2026-10-14 06:05Z');
select queue_meal_reminders('2026-10-15 06:05Z');
select results_eq(
  $$select distinct reminder_date from notification_deliveries
    where list_id = 'b1000000-0000-4000-8000-000000000001' order by reminder_date$$,
  $$values ('2026-10-12'::date), ('2026-10-14'::date)$$,
  'Empty days follow the household rhythm');

select set_config('request.jwt.claim.role', 'service_role', true);
select results_eq(
  $$select kind, slot_date, activity_id, day_meals, items_to_buy
    from claim_notification_deliveries(gen_random_uuid())
    where list_id = 'b1000000-0000-4000-8000-000000000001'
      and device_id = 'a2000000-0000-4000-8000-000000000001'
    order by slot_date$$,
  $$values
    ('meal_reminder', '2026-10-12', null::uuid,
     '[{"meal": "lunch", "name": "Soup"}, {"meal": "dinner", "name": "Lasagne"}]'::jsonb, 2),
    ('meal_reminder', '2026-10-14', null::uuid, '[]'::jsonb, 0)$$,
  'The worker reads the day as it is at send time, with what is left to buy');
select set_config('request.jwt.claim.role', '', true);

select * from finish();
rollback;

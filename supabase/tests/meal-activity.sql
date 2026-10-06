begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

-- Anna (…1) and Ben (…2) share a household. Writes run as the uploading
-- member, the way PowerSync uploads them; reads go back to postgres.
insert into auth.users (id) values
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002');
insert into public.lists (id, name, created_by) values
  ('b1000000-0000-4000-8000-000000000001', 'Family', 'a1000000-0000-4000-8000-000000000001');
insert into public.household_profiles (id) values ('b1000000-0000-4000-8000-000000000001');
insert into public.list_members (list_id, user_id) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002');
insert into public.household_people (id, list_id, user_id, name, meal_times) values
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'Anna', 'All meals'),
  ('c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000002', 'Ben', 'All meals');
insert into public.push_devices (id, installation_id, user_id, expo_push_token, platform, time_zone) values
  ('a2000000-0000-4000-8000-000000000001', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000001', 'ExpoPushToken[anna]', 'ios', null),
  ('a2000000-0000-4000-8000-000000000002', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000002', 'ExpoPushToken[ben]', 'ios', 'Europe/Berlin');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
insert into public.planned_meals (id, list_id, name, content_id, slot_date, meal) values
  ('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Lasagne',
   'e1000000-0000-4000-8000-000000000001', '2026-10-08', 'dinner');
reset role;

select results_eq(
  $$select r.user_id, a.kind, a.actor_name, a.meal_name, a.slot_date, a.meal
    from household_activity_recipients r join household_activities a on a.id = r.activity_id
    where a.list_id = 'b1000000-0000-4000-8000-000000000001'$$,
  $$values ('a1000000-0000-4000-8000-000000000002'::uuid, 'meal_planned', 'Anna', 'Lasagne', '2026-10-08', 'dinner')$$,
  'Planning a meal tells the other member, not the planner');
select is((select count(*)::integer from household_activities
  where list_id = 'b1000000-0000-4000-8000-000000000001'), 1, 'One meal, one activity');
select results_eq(
  $$select d.device_id, d.status from notification_deliveries d
    where d.list_id = 'b1000000-0000-4000-8000-000000000001'$$,
  $$values ('a2000000-0000-4000-8000-000000000002'::uuid, 'pending')$$,
  'Planning a meal queues a push for the other member''s device');
select set_config('request.jwt.claim.role', 'service_role', true);
select results_eq(
  $$select kind, actor_name, meal_name, slot_date, meal, time_zone
    from claim_notification_deliveries(gen_random_uuid())
    where list_id = 'b1000000-0000-4000-8000-000000000001'$$,
  $$values ('meal_planned', 'Anna', 'Lasagne', '2026-10-08', 'dinner', 'Europe/Berlin')$$,
  'The worker gets what it needs to write the push');
select set_config('request.jwt.claim.role', '', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
delete from public.planned_meals where id = 'd1000000-0000-4000-8000-000000000001';
reset role;
select results_eq(
  $$select r.user_id, a.kind, a.actor_name, a.meal_name, a.slot_date, a.meal
    from household_activity_recipients r join household_activities a on a.id = r.activity_id
    where a.list_id = 'b1000000-0000-4000-8000-000000000001' and a.kind <> 'meal_planned'$$,
  $$values ('a1000000-0000-4000-8000-000000000001'::uuid, 'meal_removed', 'Ben', 'Lasagne', '2026-10-08', 'dinner')$$,
  'Removing a meal tells the other member what was there');

-- Planning another meal into an occupied slot rewrites the row in place.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
insert into public.planned_meals (id, list_id, name, content_id, slot_date, meal) values
  ('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'Pasta',
   'e1000000-0000-4000-8000-000000000002', '2026-10-09', 'dinner');
update public.planned_meals set name = 'Curry', content_id = 'e1000000-0000-4000-8000-000000000003'
  where id = 'd1000000-0000-4000-8000-000000000002';
reset role;
select results_eq(
  $$select a.kind, a.meal_name, a.previous_meal_name, a.slot_date, a.meal
    from household_activities a
    where a.list_id = 'b1000000-0000-4000-8000-000000000001' and a.kind = 'meal_replaced'$$,
  $$values ('meal_replaced', 'Curry', 'Pasta', '2026-10-09', 'dinner')$$,
  'Replacing a meal names what it replaced');

-- movePlannedMeal uploads the destination before deleting the source.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
insert into public.planned_meals (id, list_id, name, content_id, slot_date, meal) values
  ('d1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'Curry',
   'e1000000-0000-4000-8000-000000000003', '2026-10-10', 'lunch');
delete from public.planned_meals where id = 'd1000000-0000-4000-8000-000000000002';
reset role;
select results_eq(
  $$select a.kind, a.meal_name, a.slot_date, a.meal, a.previous_slot_date, a.previous_meal
    from household_activities a
    where a.list_id = 'b1000000-0000-4000-8000-000000000001' and a.meal_name = 'Curry'
      and a.kind <> 'meal_replaced'$$,
  $$values ('meal_moved', 'Curry', '2026-10-10', 'lunch', '2026-10-09', 'dinner')$$,
  'Moving a meal is one activity naming where it came from');

-- A swap uploads as two PATCHes; in between, Soup sits in both slots.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
insert into public.planned_meals (id, list_id, name, content_id, slot_date, meal) values
  ('d1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'Soup',
   'e1000000-0000-4000-8000-000000000004', '2026-10-11', 'dinner'),
  ('d1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001', 'Salad',
   'e1000000-0000-4000-8000-000000000005', '2026-10-12', 'dinner');
select set_config('test.before_swap', (select count(*)::text from household_activities
  where list_id = 'b1000000-0000-4000-8000-000000000001'), true);
update public.planned_meals set name = 'Soup', content_id = 'e1000000-0000-4000-8000-000000000004'
  where id = 'd1000000-0000-4000-8000-000000000005';
update public.planned_meals set name = 'Salad', content_id = 'e1000000-0000-4000-8000-000000000005'
  where id = 'd1000000-0000-4000-8000-000000000004';
reset role;
select is((select count(*)::text from household_activities
  where list_id = 'b1000000-0000-4000-8000-000000000001'), current_setting('test.before_swap'),
  'Swaps stay quiet until uploads are atomic (ADR 21)');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
update public.planned_meals set extra_portions = 1, ingredient_swaps = '{"x": "y"}'
  where id = 'd1000000-0000-4000-8000-000000000004';
update public.planned_meals set name = 'Green salad'
  where id = 'd1000000-0000-4000-8000-000000000004';
reset role;
select results_eq(
  $$select a.kind, a.actor_name, a.meal_name, a.previous_meal_name
    from household_activities a
    where a.list_id = 'b1000000-0000-4000-8000-000000000001' and a.slot_date = '2026-10-11'
      and a.kind <> 'meal_planned'$$,
  $$values ('meal_changed', 'Ben', 'Green salad', 'Salad')$$,
  'Renaming a meal is news; portions and ingredient choices are not');

-- PowerSync retries a PUT as a full upsert with the same values.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('test.before_retry', (select count(*)::text from household_activities
  where list_id = 'b1000000-0000-4000-8000-000000000001'), true);
insert into public.planned_meals (id, list_id, name, content_id, slot_date, meal) values
  ('d1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'Curry',
   'e1000000-0000-4000-8000-000000000003', '2026-10-10', 'lunch')
  on conflict (id) do update set list_id = excluded.list_id, name = excluded.name,
    content_id = excluded.content_id, slot_date = excluded.slot_date, meal = excluded.meal,
    updated_at = now();
reset role;
select is((select count(*)::text from household_activities
  where list_id = 'b1000000-0000-4000-8000-000000000001'), current_setting('test.before_retry'),
  'An upload retry is not news');

-- A chat edit ("make it vegan") repoints the meal to a new variant.
insert into public.recipes (id) values ('f1000000-0000-4000-8000-000000000001');
insert into public.variants (id, recipe_id, name) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'Lasagne'),
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'Vegan lasagne');
set local role authenticated;
insert into public.planned_meals (id, list_id, recipe_id, variant_id, content_id, slot_date, meal) values
  ('d1000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000006', '2026-10-13', 'dinner');
update public.planned_meals set variant_id = 'f2000000-0000-4000-8000-000000000002'
  where id = 'd1000000-0000-4000-8000-000000000006';
reset role;
select results_eq(
  $$select a.kind, a.meal_name, a.previous_meal_name
    from household_activities a
    where a.list_id = 'b1000000-0000-4000-8000-000000000001' and a.slot_date = '2026-10-13'
    order by a.kind$$,
  $$values ('meal_changed', 'Vegan lasagne', 'Lasagne'), ('meal_planned', 'Lasagne', null)$$,
  'A recipe meal is named by its variant, and a new variant is a change');

-- Uploads reach Postgres directly, so the trigger asks for the push itself.
select vault.create_secret('http://worker.invalid/functions/v1/notification-worker', 'notification_worker_url');
select vault.create_secret('test-secret', 'notification_worker_secret');
select set_config('test.before_plan', (select count(*)::text from net.http_request_queue), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
insert into public.planned_meals (id, list_id, name, content_id, slot_date, meal) values
  ('d1000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000001', 'Tacos',
   'e1000000-0000-4000-8000-000000000008', '2026-10-15', 'dinner');
reset role;
select results_eq(
  $$select url, headers->>'x-notification-secret' from net.http_request_queue
    order by id offset current_setting('test.before_plan')::integer$$,
  $$values ('http://worker.invalid/functions/v1/notification-worker', 'test-secret')$$,
  'Planning a meal asks the worker to send right away');

-- The meal matters more than the news about it.
alter table public.household_activities add constraint test_activity_fails check (false) not valid;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select lives_ok($$insert into public.planned_meals (id, list_id, name, content_id, slot_date, meal) values
  ('d1000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000001', 'Risotto',
   'e1000000-0000-4000-8000-000000000007', '2026-10-14', 'dinner')$$,
  'A failing activity never fails the meal write');
reset role;

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

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
insert into public.push_devices (id, installation_id, user_id, expo_push_token, platform) values
  ('a2000000-0000-4000-8000-000000000001', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000001', 'ExpoPushToken[anna]', 'ios'),
  ('a2000000-0000-4000-8000-000000000002', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000002', 'ExpoPushToken[ben]', 'ios');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
insert into public.list_items (id, list_id, name, name_key) values
  ('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Milk', 'milk'),
  ('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'Eggs', 'eggs');
reset role;

select results_eq(
  $$select r.user_id, a.kind, a.actor_name, a.item_names
    from household_activity_recipients r join household_activities a on a.id = r.activity_id
    where a.list_id = 'b1000000-0000-4000-8000-000000000001'$$,
  $$values ('a1000000-0000-4000-8000-000000000002'::uuid, 'items_added', 'Anna', '["Milk", "Eggs"]'::jsonb)$$,
  'Adding items tells the other member once, with every name');
select results_eq(
  $$select d.device_id, d.next_attempt_at = a.closes_at, a.closes_at = now() + interval '5 minutes'
    from notification_deliveries d join household_activities a on a.id = d.activity_id
    where d.list_id = 'b1000000-0000-4000-8000-000000000001'$$,
  $$values ('a2000000-0000-4000-8000-000000000002'::uuid, true, true)$$,
  'The push waits five quiet minutes');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
update public.list_items set status = 'purchased' where id = 'd1000000-0000-4000-8000-000000000001';
reset role;
select results_eq(
  $$select a.item_names, d.next_attempt_at = now() + interval '15 minutes'
    from household_activities a join notification_deliveries d on d.activity_id = a.id
    where a.list_id = 'b1000000-0000-4000-8000-000000000001' and a.kind = 'items_bought'$$,
  $$values ('["Milk"]'::jsonb, true)$$,
  'Checking off waits fifteen quiet minutes before telling the other member');

-- A mis-tap: Anna unticks Milk and drops Eggs before either push goes out.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
update public.list_items set status = 'active' where id = 'd1000000-0000-4000-8000-000000000001';
delete from public.list_items where id = 'd1000000-0000-4000-8000-000000000002';
reset role;
select results_eq(
  $$select a.kind, a.item_names from household_activities a
    where a.list_id = 'b1000000-0000-4000-8000-000000000001'$$,
  $$values ('items_added', '["Milk"]'::jsonb)$$,
  'Undoing inside the window takes the name back; an empty activity is gone');
select is((select count(*)::integer from notification_deliveries
  where list_id = 'b1000000-0000-4000-8000-000000000001'), 1,
  'A mis-tapped check-off sends nothing');

-- Five quiet minutes later, Milk's push is due; the next add is new news.
update public.household_activities set closes_at = now() - interval '1 second'
  where list_id = 'b1000000-0000-4000-8000-000000000001';
update public.notification_deliveries set next_attempt_at = now() - interval '1 second'
  where list_id = 'b1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
insert into public.list_items (id, list_id, name, name_key) values
  ('d1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'Lemons', 'lemons');
reset role;
select results_eq(
  $$select a.item_names from household_activities a
    where a.list_id = 'b1000000-0000-4000-8000-000000000001' order by a.closes_at$$,
  $$values ('["Milk"]'::jsonb), ('["Lemons"]'::jsonb)$$,
  'A write after the window starts a new activity');

select set_config('request.jwt.claim.role', 'service_role', true);
select results_eq(
  $$select kind, actor_name, item_names
    from claim_notification_deliveries(gen_random_uuid())
    where list_id = 'b1000000-0000-4000-8000-000000000001'$$,
  $$values ('items_added', 'Anna', '["Milk"]'::jsonb)$$,
  'The worker gets what it needs to write the push, once it is due');
select set_config('request.jwt.claim.role', '', true);

select * from finish();
rollback;

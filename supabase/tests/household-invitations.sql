begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

insert into auth.users (id) values
  ('aa000000-0000-4000-8000-000000000001'),
  ('aa000000-0000-4000-8000-000000000002'),
  ('aa000000-0000-4000-8000-000000000003');
insert into public.lists (id, name, created_by) values
  ('bb000000-0000-4000-8000-000000000001', 'Family', 'aa000000-0000-4000-8000-000000000001'),
  ('bb000000-0000-4000-8000-000000000002', 'Other family', 'aa000000-0000-4000-8000-000000000001');
insert into public.household_profiles (id) values
  ('bb000000-0000-4000-8000-000000000001'), ('bb000000-0000-4000-8000-000000000002');
insert into public.list_members (list_id, user_id) values
  ('bb000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001');
insert into public.household_people (id, list_id, name, diet, meal_times) values
  ('cc000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001', 'Anna', 'vegan', 'Weekends'),
  ('cc000000-0000-4000-8000-000000000002', 'bb000000-0000-4000-8000-000000000002', 'Another Anna', 'vegan', 'Always');
select set_config('test.invite_code', (select invite_code from lists where id = 'bb000000-0000-4000-8000-000000000001'), true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from lists where id = 'bb000000-0000-4000-8000-000000000001'), 0, 'Nonmembers cannot read the household');
select is(preview_household_invite(current_setting('test.invite_code'))->'people',
  '[{"id":"cc000000-0000-4000-8000-000000000001","name":"Anna"}]'::jsonb, 'Preview exposes only names and ids, not diets');
select throws_ok($$select reset_household_invite('bb000000-0000-4000-8000-000000000001')$$,
  '42501', 'Only household members can reset its link.', 'Nonmembers cannot reset');
select throws_ok($$select accept_household_invite(current_setting('test.invite_code'), 'cc000000-0000-4000-8000-000000000002')$$,
  'PT409', 'That person is no longer available. Please choose again.', 'Cannot claim a person from another household');
reset role;
select is((select count(*)::integer from list_members where user_id = 'aa000000-0000-4000-8000-000000000002'), 0, 'Failed claim leaves no membership');
set local role authenticated;
select is(accept_household_invite(current_setting('test.invite_code'), 'cc000000-0000-4000-8000-000000000001'),
  'bb000000-0000-4000-8000-000000000001'::uuid, 'Existing eater can be claimed');
select is((select diet || '/' || meal_times from household_people where id = 'cc000000-0000-4000-8000-000000000001'),
  'vegan/Weekends', 'Claim preserves cooking details');
select is(accept_household_invite(current_setting('test.invite_code'), null, 'Duplicate'),
  'bb000000-0000-4000-8000-000000000001'::uuid, 'A lost response can be retried safely');
select is((select count(*)::integer from household_people where list_id = 'bb000000-0000-4000-8000-000000000001'), 1, 'Retry does not add another eater');
select is(preview_household_invite(current_setting('test.invite_code'))->>'joined', 'true', 'Reopening an invite recognizes your existing link');

select set_config('request.jwt.claim.sub', 'aa000000-0000-4000-8000-000000000003', true);
select throws_ok($$select accept_household_invite(current_setting('test.invite_code'), 'cc000000-0000-4000-8000-000000000001')$$,
  'PT409', 'That person is no longer available. Please choose again.', 'A second account cannot claim the same eater');
reset role;
select is((select count(*)::integer from list_members where user_id = 'aa000000-0000-4000-8000-000000000003'), 0, 'Losing the claim also rolls membership back');
set local role authenticated;
select is(accept_household_invite(current_setting('test.invite_code'), null, '  Erik  '),
  'bb000000-0000-4000-8000-000000000001'::uuid, 'The same invitation admits another person');
select is((select name from household_people where user_id = 'aa000000-0000-4000-8000-000000000003'), 'Erik', 'New member is also an eater');
select is((select meal_times from household_people where user_id = 'aa000000-0000-4000-8000-000000000003'), 'All meals', 'New eater uses normal person defaults');
select isnt(reset_household_invite('bb000000-0000-4000-8000-000000000001'), current_setting('test.invite_code'), 'Any member can reset the link');
select throws_ok($$select accept_household_invite(current_setting('test.invite_code'), null, 'Erik')$$,
  'PT404', 'This invitation is no longer valid. Ask for a new link.', 'Reset invalidates the old invitation');
select is((select count(*)::integer from list_members where list_id = 'bb000000-0000-4000-8000-000000000001'), 3, 'Reset keeps existing memberships');

select * from finish();
rollback;

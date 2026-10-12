begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(3);

-- Anna asked for a soup and closed the app. Her phone is active, her old
-- tablet signed out. Ben shares the chat but did not ask.
insert into auth.users (id) values
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002');
insert into public.lists (id, name, created_by) values
  ('b1000000-0000-4000-8000-000000000001', 'Family', 'a1000000-0000-4000-8000-000000000001');
insert into public.list_members (list_id, user_id) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002');
insert into public.push_devices (id, installation_id, user_id, expo_push_token, platform, disabled_at) values
  ('a2000000-0000-4000-8000-000000000001', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000001', 'ExpoPushToken[anna]', 'ios', null),
  ('a2000000-0000-4000-8000-000000000002', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000001', 'ExpoPushToken[anna-tablet]', 'ios', now()),
  ('a2000000-0000-4000-8000-000000000003', gen_random_uuid(),
   'a1000000-0000-4000-8000-000000000002', 'ExpoPushToken[ben]', 'ios', null);
insert into public.chats (id, list_id, title) values
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Green soup');
insert into public.chat_messages (id, chat_id, list_id, role, parts) values
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000001', 'assistant',
   '[{"type": "step-start"},
     {"type": "tool-readPlan", "toolCallId": "t1", "state": "output-available", "output": {"days": []}},
     {"type": "text", "text": "Here is a green soup."},
     {"type": "data-turn", "id": "turn", "data": {"status": "completed"}}]');

select queue_chat_reply('c2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001');
select queue_chat_reply('c2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001');
select results_eq(
  $$select device_id from notification_deliveries
    where chat_message_id = 'c2000000-0000-4000-8000-000000000001'$$,
  $$values ('a2000000-0000-4000-8000-000000000001'::uuid)$$,
  'Only the asking user''s active devices hear, once');

select throws_ok(
  $$insert into notification_deliveries (list_id, user_id, device_id, reminder_date, chat_message_id)
    values ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
            'a2000000-0000-4000-8000-000000000001', '2026-10-12', 'c2000000-0000-4000-8000-000000000001')$$,
  '23514', null,
  'A delivery is about one thing');

select set_config('request.jwt.claim.role', 'service_role', true);
select results_eq(
  $$select kind, chat_id, chat_title, reply_parts
    from claim_notification_deliveries(gen_random_uuid())
    where device_id = 'a2000000-0000-4000-8000-000000000001'$$,
  $$values ('chat_reply', 'c1000000-0000-4000-8000-000000000001'::uuid, 'Green soup',
     '[{"type": "text", "text": "Here is a green soup."},
       {"type": "data-turn", "id": "turn", "data": {"status": "completed"}}]'::jsonb)$$,
  'The worker reads the reply''s text and turn state, not its tool output');
select set_config('request.jwt.claim.role', '', true);

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into auth.users (id) values
  ('ee000000-0000-4000-8000-000000000001'),
  ('ee000000-0000-4000-8000-000000000002');

-- push_devices is server-only (ADR 19): actions run as the caller, reads
-- go back to postgres because authenticated has no grants on the table.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ee000000-0000-4000-8000-000000000001', true);
select isnt(register_push_device('ff000000-0000-4000-8000-000000000001', 'ExpoPushToken[test]', 'ios'),
  null, 'Registration returns the device id');
select lives_ok($$select unregister_push_device('ff000000-0000-4000-8000-000000000001', 'permission_revoked')$$,
  'Unregistering with a reason succeeds');
reset role;
select is((select disabled_reason from push_devices
  where installation_id = 'ff000000-0000-4000-8000-000000000001'),
  'permission_revoked', 'A revoked permission is recorded, not a sign-out');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ee000000-0000-4000-8000-000000000001', true);
select is(register_push_device('ff000000-0000-4000-8000-000000000001', 'ExpoPushToken[test]', 'ios'),
  register_push_device('ff000000-0000-4000-8000-000000000001', 'ExpoPushToken[test]', 'ios'),
  'Re-registering is idempotent for one installation');
reset role;
select is((select count(*)::integer from push_devices
  where installation_id = 'ff000000-0000-4000-8000-000000000001' and disabled_at is null),
  1, 'Re-registering revives the same installation');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ee000000-0000-4000-8000-000000000002', true);
select lives_ok($$select unregister_push_device('ff000000-0000-4000-8000-000000000001')$$,
  'Another user calling unregister does not error');
reset role;
select is((select count(*)::integer from push_devices
  where installation_id = 'ff000000-0000-4000-8000-000000000001' and disabled_at is null),
  1, 'Another user''s unregister call leaves the device active');

select * from finish();
rollback;

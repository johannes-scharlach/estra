-- Runs on `supabase db reset`. Categories are real reference data and ship
-- to production too; the user and demo list below are local only.

insert into public.categories (id, name, sort_order) values
  ('produce',    'Fruit & Vegetables', 10),
  ('bakery',     'Bread & Bakery',     20),
  ('dairy',      'Dairy & Eggs',       30),
  ('meat',       'Meat & Fish',        40),
  ('frozen',     'Frozen',             50),
  ('pantry',     'Pantry',             60),
  ('drinks',     'Drinks',             70),
  ('snacks',     'Snacks & Sweets',    80),
  ('household',  'Household',          90),
  ('personal',   'Personal Care',     100),
  ('other',      'Other',             999)
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- Local development only
-- --------------------------------------------------------------------------

-- The migration creates powersync_role without a password so no credential
-- is committed. Local dev issues a throwaway one here; production sets its
-- own and puts it in the PowerSync instance's connection settings.
alter role powersync_role with password 'powersync';

-- The token columns must be '' and never NULL: GoTrue scans them into
-- non-nullable Go strings, and a NULL makes every login fail with
-- "Database error querying schema" (a 500, with the real cause only
-- visible in the auth container's logs).
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token,
  created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'dev@estra.local',
  crypt('estra-dev', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '',
  '', '', '',
  '', '', '',
  now(), now()
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, created_at, updated_at
)
values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"dev@estra.local"}',
  'email', now(), now()
)
on conflict do nothing;

insert into public.lists (id, name, invite_code, created_by)
values (
  '33333333-3333-3333-3333-333333333333',
  'Home',
  'estradev',
  '11111111-1111-1111-1111-111111111111'
)
on conflict (id) do nothing;

insert into public.list_members (list_id, user_id)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111'
)
on conflict (list_id, user_id) do nothing;

-- Ids here are arbitrary; the app generates deterministic ones from
-- (list_id, name_key) so two offline devices adding the same thing converge.
insert into public.list_items (id, list_id, name, name_key, category_id, status, purchase_count, added_by)
values
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Oat milk',  'oat milk',  'dairy',   'active',    4, '11111111-1111-1111-1111-111111111111'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Bananas',   'bananas',   'produce', 'active',    9, '11111111-1111-1111-1111-111111111111'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Sourdough', 'sourdough', 'bakery',  'active',    2, '11111111-1111-1111-1111-111111111111'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Coffee',    'coffee',    'pantry',  'purchased', 6, '11111111-1111-1111-1111-111111111111'),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'Dish soap', 'dish soap', 'household','purchased', 1, '11111111-1111-1111-1111-111111111111')
on conflict (list_id, name_key) where planned_meal_id is null do nothing;

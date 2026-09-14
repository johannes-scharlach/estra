-- Runs on `supabase db reset`. The user and demo list below are local only.

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

-- Match the deterministic ids the app generates from (list_id, name_key) so
-- seed rows can be re-added without colliding with list_items_standalone_dedupe.
create extension if not exists "uuid-ossp";

create or replace function public.item_name_key(name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(name), '\s+', ' ', 'g'));
$$;

create or replace function public.uuid_for_item(target_list_id uuid, item_name text)
returns uuid
language sql
immutable
as $$
  select uuid_generate_v5(
    '6f9a1c2e-2b7a-5f3d-9c41-0e8b6d5a4f77'::uuid,
    target_list_id::text || ':' || public.item_name_key(item_name)
  );
$$;

insert into public.list_items (id, list_id, name, name_key, category_id, status, purchase_count, added_by)
values
  (public.uuid_for_item('33333333-3333-3333-3333-333333333333', 'Oat milk'),  '33333333-3333-3333-3333-333333333333', 'Oat milk',  'oat milk',  'dairy',    'active',    4, '11111111-1111-1111-1111-111111111111'),
  (public.uuid_for_item('33333333-3333-3333-3333-333333333333', 'Bananas'),   '33333333-3333-3333-3333-333333333333', 'Bananas',   'bananas',   'produce',  'active',    9, '11111111-1111-1111-1111-111111111111'),
  (public.uuid_for_item('33333333-3333-3333-3333-333333333333', 'Sourdough'), '33333333-3333-3333-3333-333333333333', 'Sourdough', 'sourdough', 'bakery',   'active',    2, '11111111-1111-1111-1111-111111111111'),
  (public.uuid_for_item('33333333-3333-3333-3333-333333333333', 'Coffee'),    '33333333-3333-3333-3333-333333333333', 'Coffee',    'coffee',    'breakfast',   'purchased', 6, '11111111-1111-1111-1111-111111111111'),
  (public.uuid_for_item('33333333-3333-3333-3333-333333333333', 'Dish soap'), '33333333-3333-3333-3333-333333333333', 'Dish soap', 'dish soap', 'household','purchased', 1, '11111111-1111-1111-1111-111111111111')
on conflict (list_id, name_key) where planned_meal_id is null do nothing;

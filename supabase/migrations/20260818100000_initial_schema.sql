-- Estra: shared shopping lists.
--
-- The spine of this schema is `list_members`. Nothing is owned by a user
-- directly except through membership of a list — every RLS policy and every
-- sync rule asks "is the caller a member of this list?" rather than
-- comparing an owner_id.
--
-- Postgres keeps real types here (timestamptz, boolean). PowerSync converts
-- on the way to the device, where SQLite only has text, integer and real.
-- See apps/mobile/src/db/schema.ts for the client mirror.

-- --------------------------------------------------------------------------
-- categories — global reference data, seeded, read-only to clients
-- --------------------------------------------------------------------------

-- Text slugs rather than uuids: these are stable, human-readable in queries,
-- and referenced from seed data.
create table public.categories (
  id          text primary key,
  name        text not null,
  sort_order  integer not null default 0
);

-- --------------------------------------------------------------------------
-- lists and membership
-- --------------------------------------------------------------------------

create table public.lists (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  -- Short shareable code. Redeemed via the join-list edge function, which
  -- needs service-role because the joiner cannot see the list yet.
  invite_code  text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_by   uuid not null references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- PowerSync requires every synced table to have a single `id` column, so
-- this cannot use (list_id, user_id) as a composite primary key.
create table public.list_members (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  unique (list_id, user_id)
);

-- --------------------------------------------------------------------------
-- list_items
--
-- This table is both the current list and its history — there is no separate
-- catalogue table. A checked-off item stays as status='purchased' and
-- becomes a "recent" suggestion, which is also what makes autocomplete and
-- remembered categories work without a second source of truth that a
-- co-shopper might not be able to see.
-- --------------------------------------------------------------------------

create table public.list_items (
  id              uuid primary key,
  list_id         uuid not null references public.lists (id) on delete cascade,

  name            text not null,
  -- Normalised name ('Oat Milk ' -> 'oat milk'). The dedupe key, and the
  -- basis of the deterministic id — see uuidForItem() on the client.
  name_key        text not null,

  category_id     text references public.categories (id) on delete set null,
  -- Free-text qualifier for this shop only: '2 bunches', 'the oat one'.
  spec            text,

  status          text not null default 'active' check (status in ('active', 'purchased')),
  -- Bumped on each purchase so autocomplete can rank by how often you
  -- actually buy something.
  purchase_count  integer not null default 0,

  added_by        uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One row per distinct item per list. Upholds the invariant even if a
  -- client generates an id some other way; the deterministic id is what
  -- normally prevents a collision from ever reaching the server.
  unique (list_id, name_key)
);

create index list_members_user_idx on public.list_members (user_id);
create index list_items_list_status_idx on public.list_items (list_id, status);
create index list_items_recent_idx on public.list_items (list_id, updated_at desc);

-- --------------------------------------------------------------------------
-- updated_at
-- --------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lists_set_updated_at
  before update on public.lists
  for each row execute function public.set_updated_at();

create trigger list_items_set_updated_at
  before update on public.list_items
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- Membership check
--
-- A policy on list_members that queries list_members sends Postgres into
-- infinite recursion. SECURITY DEFINER runs the lookup with the function
-- owner's rights, which bypasses RLS on the inner query and breaks the
-- cycle. `set search_path` is not optional here: without it, a caller could
-- shadow `public` and have this function resolve tables they control.
-- --------------------------------------------------------------------------

create or replace function public.is_list_member(target_list_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.list_members
    where list_id = target_list_id
      and user_id = auth.uid()
  );
$$;

revoke execute on function public.is_list_member(uuid) from public;
grant execute on function public.is_list_member(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- Row level security
--
-- Sync streams decide what reaches a device. RLS is what stops a client
-- writing outside its own lists through the REST API. Both are required.
-- --------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.list_items enable row level security;

-- Reference data: readable by everyone, writable by no one.
create policy "categories are readable" on public.categories
  for select to authenticated
  using (true);

create policy "members can read lists" on public.lists
  for select to authenticated
  using (public.is_list_member(id));

create policy "anyone can create a list" on public.lists
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "members can update lists" on public.lists
  for update to authenticated
  using (public.is_list_member(id))
  with check (public.is_list_member(id));

-- Deliberately narrower than the rest of the flat-membership model:
-- deleting a shared list is not something one member should do to everyone.
create policy "creator can delete lists" on public.lists
  for delete to authenticated
  using (created_by = auth.uid());

create policy "members can read membership" on public.list_members
  for select to authenticated
  using (public.is_list_member(list_id));

create policy "members and creators can add members" on public.list_members
  for insert to authenticated
  with check (
    public.is_list_member(list_id)
    -- The list creator's own first membership row: at that instant they are
    -- not yet a member, so is_list_member() is still false.
    or exists (
      select 1 from public.lists l
      where l.id = list_id and l.created_by = auth.uid()
    )
  );

-- Leave a list, but do not remove other people from one.
create policy "members can remove themselves" on public.list_members
  for delete to authenticated
  using (user_id = auth.uid());

create policy "members have full access to items" on public.list_items
  for all to authenticated
  using (public.is_list_member(list_id))
  with check (public.is_list_member(list_id));

-- --------------------------------------------------------------------------
-- Grants
--
-- RLS filters rows; it does not grant access. Supabase's default privileges
-- for tables created in `public` hand out only TRUNCATE/REFERENCES/TRIGGER
-- to anon and authenticated — not SELECT/INSERT/UPDATE/DELETE — so without
-- these every query fails with "permission denied for table" before a
-- policy is ever evaluated.
--
-- service_role bypasses RLS but still needs table privileges: the join-list
-- edge function reads `lists` and writes `list_members` through it.
--
-- anon is granted nothing. Everything here requires a signed-in user.
-- --------------------------------------------------------------------------

grant select on public.categories to authenticated;

grant select, insert, update, delete
  on public.lists, public.list_members, public.list_items
  to authenticated;

grant select, insert, update, delete
  on public.categories, public.lists, public.list_members, public.list_items
  to service_role;

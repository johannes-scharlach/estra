-- ADR 9: chats live in the database, the server writes them.
--
-- Two tables, scoped by list so the household shares a conversation. Only
-- the API server writes here (through its direct Postgres connection, see
-- apps/api/src/routes/chats.ts); clients read via PowerSync. That is why
-- `authenticated` gets SELECT and nothing else — there is no client write
-- path to protect, and the server's role bypasses RLS.

-- --------------------------------------------------------------------------
-- chats
-- --------------------------------------------------------------------------
create table public.chats (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists (id) on delete cascade,
  -- Attribution only. Access is list membership, like everything else.
  created_by  uuid references auth.users (id) on delete set null,
  -- First user message at creation; the latest Sketch title once one exists.
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index chats_list_recent_idx on public.chats (list_id, updated_at desc);

create trigger chats_set_updated_at
  before update on public.chats
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- chat_messages
--
-- `parts` is the AI SDK UIMessage.parts array, stored as is, so text, tool
-- calls and tool results round-trip without a schema of our own.
--
-- list_id is denormalised from chats so the sync stream and the RLS policy
-- are the same single join every other table uses.
-- --------------------------------------------------------------------------
create table public.chat_messages (
  id          uuid primary key,
  chat_id     uuid not null references public.chats (id) on delete cascade,
  list_id     uuid not null references public.lists (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'system')),
  parts       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index chat_messages_chat_idx on public.chat_messages (chat_id, created_at);

-- --------------------------------------------------------------------------
-- Row level security — read-only for members. No insert/update/delete
-- policies on purpose: the API server is the only writer.
-- --------------------------------------------------------------------------
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

create policy "members can read chats" on public.chats
  for select to authenticated
  using (public.is_list_member(list_id));

create policy "members can read chat messages" on public.chat_messages
  for select to authenticated
  using (public.is_list_member(list_id));

grant select on public.chats, public.chat_messages to authenticated;

grant select, insert, update, delete
  on public.chats, public.chat_messages
  to service_role;

-- --------------------------------------------------------------------------
-- Replication
-- --------------------------------------------------------------------------
alter table public.chats replica identity full;
alter table public.chat_messages replica identity full;

alter publication powersync add table public.chats;
alter publication powersync add table public.chat_messages;

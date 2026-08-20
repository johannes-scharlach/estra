# Schema and replication changes

The Postgres schema exists in three places that must move together:
`supabase/migrations/` (authoritative), `powersync/sync-config.yaml`,
and `apps/mobile/src/db/schema.ts`.

## Columns

- A new column must land in all three places. A column missing from the
  client schema arrives as `undefined` — no error.
- Local SQLite has only `text`, `integer`, `real`: booleans are 0/1,
  timestamps are ISO strings. Use `double precision`, never `numeric`, in
  Postgres.

## New synced table

Needs all four, or rows never reach devices:

1. the `create table`
2. an entry in `create publication powersync`
3. `replica identity full`
4. a sync rule in `powersync/sync-config.yaml`

## Reads vs writes

- Sync rules only decide what a device can read.
- Writes go through Supabase's REST API under RLS, which also needs explicit
  `grant`s to `authenticated` — RLS filters rows but grants nothing.
- RLS policies call `is_list_member(uuid)` (SECURITY DEFINER). A policy on
  `list_members` that queries `list_members` recurses infinitely.

## Row ids

`list_items` ids are `itemId(listId, name)` (`apps/mobile/src/db/items.ts`)
— uuidv5, never random. Two people adding "milk" offline must produce the
same row id or one add is silently lost.

## After changes

- PowerSync does not reload `sync-config.yaml` on change: `pnpm sync:reload`.
- `pnpm db:reset` (migrations + seed), `pnpm db:diff <name>`,
  `pnpm db:types`.

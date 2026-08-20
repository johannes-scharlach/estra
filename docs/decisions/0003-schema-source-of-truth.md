# 3. Postgres migrations are the source of truth for the schema

Date: 2026-08-18
Status: Accepted

## Context

This stack describes the schema in three places, and nothing enforces that
they agree:

1. `supabase/migrations/*.sql` — the Postgres tables
2. `powersync/sync-config.yaml` — which rows reach which user
3. `apps/mobile/src/db/schema.ts` — the client-side SQLite mirror

Drift is silent. A column added to Postgres but not to the client schema
simply never arrives on the device: no error, just `undefined`. A table
added to Postgres but not to the publication never replicates at all.

## Decision

`supabase/migrations/` is authoritative. The other two are mirrors, and
changing one without the others is a bug. Schema changes touch all three
files in a single commit.

## Consequences

- Adding a table means: migration, add to `create publication powersync`,
  `alter table … replica identity full`, add to sync rules, add to the
  client `Schema`.
- Type mapping is not one-to-one. Local SQLite has only `text`, `integer`
  and `real`: booleans become 0/1, timestamps and dates become ISO strings,
  and `numeric` is avoided in Postgres in favour of `double precision`
  because arbitrary precision has no clean SQLite counterpart.
- `REPLICA IDENTITY FULL` is required. Without it Postgres only writes the
  primary key to the WAL on update/delete, and PowerSync cannot determine
  which buckets a row is leaving — rows linger on devices that should no
  longer see them.
- Sync rules are not an authorization boundary. They control reads; writes
  go through Supabase's REST API and are governed by RLS. Both must agree,
  and RLS is the one that actually stops a malicious client.
- The service does not watch `sync-config.yaml`. Run `pnpm sync:reload`.

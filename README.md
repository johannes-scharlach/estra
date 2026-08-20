# Estra

Shared shopping lists, offline-first.

**Stack:** Expo (React Native) · PowerSync · Supabase · Supabase Edge Functions

The app reads and writes local SQLite and is fully usable with no network.
PowerSync replicates that SQLite against Postgres in the background.

Lists are shared: membership in `list_members`, not a user id on each row,
is what grants access. Every RLS policy and every sync stream keys off it.

## Layout

```
apps/mobile/          Expo app (expo-router)
  src/db/             PowerSync schema, Supabase connector, providers
  src/lib/            env + Supabase client
supabase/             Postgres migrations, seed, edge functions (Deno)
powersync/            service.yaml (self-host) + sync-config.yaml (shared)
docker-compose.yml    MongoDB + PowerSync service for local dev
docs/decisions/       ADRs — read these before changing the architecture
```

`supabase/` is intentionally outside the pnpm workspace; it runs on Deno.
See [ADR 1](docs/decisions/0001-monorepo-layout.md).

## Prerequisites

Docker Desktop, Node 22+, pnpm 10+.

The Supabase CLI is a dev dependency rather than a global install, so its
version is pinned in the lockfile — run it as `pnpm supabase <command>`.
It ships as a postinstall-downloaded binary, which pnpm 10 blocks by
default; `supabase` is listed in `pnpm.onlyBuiltDependencies` to allow it.

Tailscale is only needed to run on a physical device:
`brew install --cask tailscale`.

## Setup

```bash
pnpm install

# Generate the ES256 signing key PowerSync verifies JWTs against, then
# bring up Postgres, Auth, Storage and the edge runtime.
pnpm supabase gen signing-key --algorithm ES256 --append
pnpm stack:up

cp apps/mobile/.env.example apps/mobile/.env.local
# Fill in EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the `supabase start` output.
```

PowerSync needs a native SQLite module, so **Expo Go will not work.** Build
a dev client once:

```bash
pnpm --filter mobile ios      # or: android
```

Thereafter `pnpm dev` is enough.

Seeded login: `dev@estra.local` / `estra-dev`.

## Running on a physical device

`localhost` in `.env.local` works for a simulator only. For a real phone,
put both machines on a tailnet and use that address:

```bash
tailscale ip -4     # e.g. 100.101.102.103
```

Set `EXPO_PUBLIC_SUPABASE_URL=http://100.101.102.103:55321` and
`EXPO_PUBLIC_POWERSYNC_URL=http://100.101.102.103:8080`, and add the same
host to `additional_redirect_urls` in `supabase/config.toml` — otherwise
auth redirects bounce to an address the phone cannot reach.

A LAN IP works too, but changes when you switch networks and dies off Wi-Fi.

## Everyday commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Metro bundler |
| `pnpm stack:up` / `stack:down` | Supabase + PowerSync containers |
| `pnpm stack:logs` | Tail the PowerSync service |
| `pnpm db:reset` | Rebuild Postgres from migrations + seed |
| `pnpm db:diff <name>` | Capture Studio changes as a migration |
| `pnpm db:types` | Regenerate Postgres types |
| `pnpm sync:reload` | Restart PowerSync after editing sync rules |
| `pnpm fn:serve` | Edge functions with hot reload |

## Changing the schema

The schema lives in three files that must move together — see
[ADR 3](docs/decisions/0003-schema-source-of-truth.md). Drift is silent: a
column missing from the client schema just arrives as `undefined`.

1. `supabase/migrations/` — the table (plus publication + replica identity)
2. `powersync/sync-config.yaml` — which rows reach which user
3. `apps/mobile/src/db/schema.ts` — the client mirror

## Data model

Background and trade-offs: [ADR 4](docs/decisions/0004-shared-lists-and-item-history.md).

`list_items` is both the current list and its history. Checking something
off sets `status = 'purchased'` rather than deleting the row, which is what
makes the recent strip, autocomplete and remembered categories work from a
single table that every member of the list can see.

Item ids are derived — `uuidv5(list_id + normalised name)` — not random. Two
people adding "milk" while both offline generate the same id, so their
writes converge on one row instead of colliding on the unique constraint.
See `apps/mobile/src/db/items.ts`.

Then `pnpm db:reset && pnpm sync:reload`.

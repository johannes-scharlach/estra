# Estra

Shared shopping lists that work offline.

**Stack:** Expo (React Native) · PowerSync · Supabase · Supabase Edge Functions

The app reads and writes a local SQLite database, so it works with no
network. PowerSync syncs that database with Postgres in the background.

Lists are shared through rows in `list_members`, not a user id on each row.
All RLS policies and sync rules check this table.

## Layout

```
apps/mobile/          Expo app (expo-router)
  src/db/             PowerSync schema, Supabase connector, providers
  src/lib/            env + Supabase client
apps/api/             Hono server on Node, deployed to Fly.io
supabase/             Postgres migrations, seed, edge functions (Deno)
powersync/            sync-config.yaml (shared) · local-service.yaml
                      (local Docker) · service.yaml + cli.yaml (PowerSync
                      Cloud, via the `powersync` CLI)
docker-compose.yml    MongoDB + PowerSync service for local dev
docs/decisions/       ADRs — read before changing the architecture
```

`supabase/` is not part of the pnpm workspace. It runs on Deno.
See [ADR 1](docs/decisions/0001-monorepo-layout.md).

## Prerequisites

Docker Desktop, Node 22+, pnpm 10+.

The Supabase CLI is a dev dependency, not a global install, so its version
is pinned in the lockfile. Run it as `pnpm supabase <command>`. The binary
downloads in a postinstall script; pnpm 10 blocks those by default, so
`supabase` is listed in `pnpm.onlyBuiltDependencies`.

Tailscale is only needed to run on a real phone:
`brew install --cask tailscale`.

## Setup

```bash
pnpm install

# Generate the ES256 key PowerSync uses to verify JWTs, then start
# Postgres, Auth, Storage and the edge runtime.
pnpm supabase gen signing-key --algorithm ES256 --append
pnpm stack:up

cp apps/mobile/.env.example apps/mobile/.env.local
# Copy EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from the `supabase start` output.
```

PowerSync needs a native SQLite module, so Expo Go will not work. Build a
dev client once:

```bash
pnpm --filter mobile ios      # or: android
```

After that, `pnpm dev` is enough.

Seeded login: `dev@estra.local` / `estra-dev`.

## Running on a physical device

`localhost` in `.env.local` only works on a simulator. For a real phone,
connect both machines to a tailnet and use that address:

```bash
tailscale ip -4     # e.g. 100.101.102.103
```

Set `EXPO_PUBLIC_SUPABASE_URL=http://100.101.102.103:55321` and
`EXPO_PUBLIC_POWERSYNC_URL=http://100.101.102.103:8080`. Also add the same
host to `additional_redirect_urls` in `supabase/config.toml`, or auth
redirects will point to an address the phone cannot reach.

A LAN IP works too, but it changes when you switch networks and stops
working off Wi-Fi.

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
| `pnpm api` | API server with hot reload (port 8787) |
| `pnpm api:deploy` | Ship the API server to Fly.io |

## API server

`apps/api` is a Hono server on Node, for work that does not suit an edge
function — streaming a chat response, anything long-running or stateful.
Everything else stays in `supabase/functions`.
See [ADR 5](docs/decisions/0005-api-server-on-fly.md).

```bash
cp apps/api/.env.example apps/api/.env   # needs a Gemini key, see the file
pnpm api
```

Routes under `/v1` need a Supabase access token, verified against the
project's JWKS. `/health` is open, for Fly's health check.

`POST /v1/chats/:id/messages` is the cook. It takes one new user message,
loads the chat's history from Postgres, streams the reply in the AI SDK's
UI message stream protocol, and persists both messages. The chat id is
chosen by the client; the first message creates the chat. See
[ADR 9](docs/decisions/0009-chats-in-the-database.md).

```bash
curl -N http://localhost:8787/v1/chats/$(uuidgen | tr A-Z a-z)/messages \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"listId":"<list uuid>","message":{"id":"'$(uuidgen | tr A-Z a-z)'","role":"user","parts":[{"type":"text","text":"half a squash and some bacon"}]}}'
```

Deploying, the first time:

```bash
fly apps create estra-api
fly secrets set SUPABASE_URL=https://<project-ref>.supabase.co \
  GOOGLE_GENERATIVE_AI_API_KEY=... --app estra-api
pnpm api:deploy
```

`pnpm api:deploy` runs from the repo root on purpose — the Docker build
needs the pnpm lockfile, which is above `apps/api`.

## Changing the schema

The schema lives in three files. Change them together — see
[ADR 3](docs/decisions/0003-schema-source-of-truth.md). If they drift
apart, nothing errors: a column missing from the client schema just shows
up as `undefined`.

1. `supabase/migrations/` — the table (plus publication + replica identity)
2. `powersync/sync-config.yaml` — which rows reach which user
3. `apps/mobile/src/db/schema.ts` — the client mirror

Then run `pnpm db:reset && pnpm sync:reload`.

## Data model

Background and trade-offs: [ADR 4](docs/decisions/0004-shared-lists-and-item-history.md).

`list_items` holds both the current list and its history. Checking an item
off sets `status = 'purchased'`; the row is not deleted. One table then
serves the recent strip, autocomplete and remembered categories, and every
list member sees it.

Item ids are not random. They are `uuidv5(list_id + normalised name)`. Two
people can add "milk" while offline and both create the same id, so their
writes end up in one row instead of failing the unique constraint.
See `apps/mobile/src/db/items.ts`.

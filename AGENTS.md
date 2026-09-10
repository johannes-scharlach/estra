# Estra

Expo + PowerSync + Supabase. Read `docs/decisions/` before architectural
changes, `docs/schema-changes.md` before touching the schema or sync rules.
`CLAUDE.md` is a symlink to this file.

## Commands

- Verify with `pnpm typecheck` and `pnpm lint`. Mobile tests:
  `pnpm --filter mobile test`. Read `docs/testing.md` before adding or
  restructuring tests.
- The Supabase CLI is a dev dependency, not a global: `pnpm supabase <cmd>`.
- `pnpm stack:up` runs `supabase start` before `docker compose up` — the
  compose file needs the Docker network Supabase creates. `mongo-rs-init`
  sitting in "Exited (0)" is success.
- Expo Go works via `@powersync/adapter-sql-js` (JS-only SQLite, in-memory,
  alpha — dev convenience only). Native dev builds use op-sqlite: `pnpm ios`
  once, then `pnpm dev`.
- Seeded login: `dev@estra.local` / `estra-dev`.
- `pnpm api` runs the Hono server (`apps/api`); `pnpm api:deploy` ships it
  to Fly.io from the repo root, which is where the Docker context has to be.

## Constraints

- `supabase/` is Deno and outside the pnpm workspace on purpose. Shared
  edge-function code goes in `supabase/functions/_shared/`, never `packages/`.
- op-sqlite build flags (SQLCipher, FTS5) go in the root `package.json`
  (modules hoist there), not `apps/mobile/package.json`.
- Streaming and long-running work goes in `apps/api`; request/response work
  stays in `supabase/functions`. ADR 5 has the split.
- `apps/api` ships as one esbuild bundle (`dist/index.cjs`) with no
  `node_modules` in the image, so its deps come from the workspace lockfile.
  CJS, not ESM — the Dockerfile says why.

## Conventions

- Files are kebab-case.

## Communication

Respond terse. Simple language is best. Technical substance stays. Avoid fluff and jargon.

## Design philosophy

Normal flow: Framing -> Shaping -> User sign-off -> Implement
Simple ask: just do it.

During shaping, ask "What would Kent Beck say?" to avoid premature abstractions and features nobody asked for. Stop and simplify the shape before presenting the plan.

During implementation, also ask "What would Kent Beck say?" to write clear code and refactor well. Prefer simple things, small safe steps, and designs that match the problem.

## Environment control

You're a guest on the user's machine. You never erase data, start or stop services without explicit user consent.

This also extends to things like build and dev scripts. The user owns those and you only advise on it. It's normal for the user to always have the dev script running.

## Delegation

Generally avoid delegating implementation. In particular implementation where craft truly shines. You can of course delegate anything where details don't matter so much.
If in doubt, ask the user if it's a good task to delegate or not.

# 1. Monorepo with `apps/`, Supabase outside the workspace

Date: 2026-08-18
Status: Accepted

## Context

Estra has three deployable things from the outset: the Expo app, Supabase
edge functions, and — likely later — a Fly.io service for background jobs
that do not suit a request-scoped function.

## Decision

A pnpm workspace covering `apps/*` and `packages/*`. `supabase/` sits at the
repo root and is deliberately **not** a workspace package.

## Consequences

- Relocating an Expo app after the fact is disruptive (EAS config, native
  project dirs, Metro roots). Creating `apps/mobile` up front costs nothing
  and a future `apps/api` drops in beside it.
- Edge functions run on Deno with JSR/URL imports. Keeping them out of the
  Node workspace stops pnpm from trying to resolve them and stops the TS
  language server from applying one module system to both. The Deno LSP is
  scoped to `supabase/functions` in `.vscode/settings.json`.
- Deno cannot cleanly consume a pnpm workspace package, so code shared
  between functions lives in `supabase/functions/_shared/`, not `packages/`.
- No `packages/*` exists yet. Adding one before a second consumer exists
  would be a directory with extra ceremony and one importer.
- pnpm needs `node-linker=hoisted` in `.npmrc`: Metro and native autolinking
  cannot follow pnpm's default symlinked layout.
- `@op-engineering/op-sqlite` reads build flags (SQLCipher, FTS5) from the
  package.json where modules are hoisted to — the **root** one in a
  monorepo, not `apps/mobile/package.json`.

# 2. Local Supabase + self-hosted PowerSync for development

Date: 2026-08-18
Status: Accepted

## Context

PowerSync Cloud reaches Postgres over the internet via logical replication,
so it cannot see a Supabase running on a laptop. That forces a choice
between two coherent pairs rather than a free mix:

1. local Supabase + self-hosted PowerSync (Docker)
2. hosted Supabase + PowerSync Cloud

A third option exists — local Supabase exposed to PowerSync Cloud through an
ngrok TCP tunnel — but it requires generating an SSL cert inside the
Supabase Postgres container, and on ngrok's free tier the hostname and port
change every session, meaning the PowerSync instance must be reconfigured
each time. PowerSync's own docs call self-hosting the more user-friendly
workflow.

Separately: the Supabase free plan allows two active projects **per
account**, counted across every organisation where you are Owner or Admin,
so a second free organisation does not raise the ceiling. One slot is
already spoken for.

## Decision

Develop against local Supabase plus PowerSync in Docker. Reserve the
remaining free Supabase slot for production.

## Consequences

- `pnpm stack:up` is `supabase start` followed by `docker compose up -d`.
  Roughly a dozen containers, plus MongoDB (PowerSync's bucket storage,
  which needs a replica set) — budget a few GB of RAM.
- No tunnel, no certificate ceremony: PowerSync reaches Postgres over
  Supabase's internal Docker network as `supabase_db_estra:5432`.
- `supabase db reset` rebuilds the entire world from migrations and seed,
  which is a good property while the schema moves daily.
- A simulator can talk to `localhost`. A physical device cannot. Use
  Tailscale — it gives the Mac and the phone stable addresses that survive
  network changes and work over cellular, unlike a LAN IP. The address must
  match `site_url` in `supabase/config.toml` or auth redirects break.
- Production setup, when it arrives, is `supabase link` + `supabase db push`
  because migrations are the source of truth.

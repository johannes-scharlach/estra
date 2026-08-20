# 5. A Node API server on Fly.io, beside the edge functions

Date: 2026-08-20
Status: Accepted

## Context

Edge functions cover request/response work well, but not everything fits
that shape. Streaming a chat response holds a connection open for tens of
seconds while writing chunks; work that outlives the request, or that wants
a warm process, fits it even less. ADR 1 already reserved a spot for this.

## Decision

`apps/api` — Node 22 + Hono, deployed to Fly.io from `apps/api/Dockerfile`.
Edge functions stay where they are; nothing moves.

Access tokens are verified locally with `jose` against Supabase's JWKS
(`/auth/v1/.well-known/jwks.json`), not by calling `/auth/v1/user`.

## Consequences

- Two backends to reason about. The split is by shape, not by feature: if a
  thing streams, runs long, or needs a warm process, it belongs here.
  Otherwise an edge function is less to deploy and less to pay for.
- Local verification keeps Supabase out of the hot path of every message —
  it matters more here than in a function, because a chat request holds a
  connection open. The trade is a token that stays valid until it expires;
  Supabase's default is one hour.
- Only the audience is checked, not the issuer, matching
  `powersync/service.yaml`. Locally Supabase issues `iss: http://127.0.0.1`
  while clients reach it as `localhost` or a tailnet IP, so pinning the
  issuer rejects good tokens. The JWKS URL is the trust anchor: only this
  Supabase project can produce a signature that verifies against it.
- The server holds no service-role key. It has the caller's identity and
  nothing more, so it cannot bypass RLS. Give it a Supabase client only when
  something genuinely needs one, and prefer a user-scoped one.
- Docker builds from the repo root and ships a single esbuild bundle rather
  than a `node_modules` tree, because `.npmrc` sets `node-linker=hoisted`
  for Metro and a hoisted install cannot separate this app's dependencies
  from Expo's. The bundle is built from the workspace lockfile, so every
  dependency — direct and transitive — is pinned by the same file the repo
  type-checks against. It has to be CommonJS: `@vercel/oidc`, which `ai`
  reaches through its gateway provider, calls `require()` dynamically and
  does not survive bundling to ESM.
- `POST /v1/chat` speaks the AI SDK's UI message stream protocol in both
  directions — it takes the `UIMessage[]` that `useChat` posts and returns
  what `useChat` expects. The server stores nothing; the client sends the
  whole conversation every time.
- The model is Gemini 3.7 Flash via `@ai-sdk/google`, keyed by
  `GOOGLE_GENERATIVE_AI_API_KEY`. Read at boot in `env.ts` and handed to the
  provider explicitly, so a missing key stops the server starting instead of
  failing the first chat message.

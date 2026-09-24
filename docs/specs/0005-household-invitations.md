# Household invitations

Approved in conversation, 2026-09-25. Data decision: ADR 17.

## Behavior

1. Any member chooses **Household → Invite to household → Share invite link**.
   Share one reusable HTTPS link through the native share sheet.
2. Opening it shows a public landing page with **Open Estra** and installation
   instructions. After installing, tap the original link again.
3. Recipients sign in or create an account with an email code. Skip new-household
   setup and keep the invitation through backgrounding and app restart.
4. **Join [household] — Who are you?** offers unlinked people and **I'm not
   listed**. Choose a person or enter a name, then explicitly join.
5. Add membership and link/create the person atomically. Every joining account
   is an eater. Existing cooking details remain intact; new people use normal
   person defaults and can edit their cooking details afterward.
6. A claimed/deleted person causes a refresh and a new choice, without granting
   membership. Retrying acceptance must not create duplicate people.
7. Wait for sync, then make the joined household active. Other households remain
   available through the existing switcher.
8. A linked member reopening the link enters the household without choosing
   themselves again. Old memberships without a person must choose/create one.
9. Links do not expire. Any member can reset the link, invalidating it for future
   joins while preserving existing access.

## Verification

- Database: `pnpm supabase test db supabase/tests/household-invitations.sql`
  after applying migrations. The test uses rollback-isolated fixtures.
- Mobile: `pnpm --filter mobile test`; API: `pnpm --filter api test`.
- Static: `pnpm typecheck`, `pnpm lint`, and
  `deno check --no-lock --config supabase/functions/deno.json supabase/functions/join-list/index.ts`.
- Device checks: share to a family chat; join as a new account and as an account
  already in another household; background for email verification; kill/reopen
  mid-sign-in; claim an existing person; create another person; open the same
  invitation again; reset and try the old link; attempt one person from two
  accounts; disconnect after acceptance and verify recovery waits for sync.

## Release

Apply `20260925100000_household_invitations.sql`, deploy `join-list`, deploy the
API, and ship the mobile changes. No PowerSync reload is needed.

Shared URLs use the build's `EXPO_PUBLIC_API_URL` (production:
`https://estra-api.fly.dev`). Local device testing needs a LAN/Tailscale address
reachable by the recipient. Custom-scheme opening requires a native dev/release
build; in Expo Go open its `/--/join?code=…` development URL instead.

Set optional Fly environment variables `ESTRA_IOS_INSTALL_URL` and
`ESTRA_ANDROID_INSTALL_URL` to real HTTPS store/TestFlight/distribution links.
Until supplied, the page asks recipients to get an installation link from the
inviter. Store URLs are not fabricated.

Implementation checks do not require resetting the developer's database or
starting/stopping services. During development the migration and SQL assertions
can run inside one enclosing transaction ending in rollback.

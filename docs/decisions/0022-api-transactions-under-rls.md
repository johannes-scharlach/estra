# 22. API transactions run under RLS

Date: 2026-10-06
Status: Proposed

## Context

`apps/api` connects with `DATABASE_URL` as `postgres` and bypasses RLS
(ADR 9). Authorization is by convention: each route calls `assertListMember`
or `assertListMemberUntilCommit` (`apps/api/src/list-authorization.ts`) and
every query must scope itself to the list. A forgotten scope reads or writes
another household and nothing in the database notices.

The risk is higher than usual because chat tools act on ids the model chooses
(`plannedMealId`, `variantId` in `apps/api/src/chat-tools.ts`).

Since spec 0008, `inTransaction(userId, work)` calls `actAs`, which sets
`request.jwt.claim.sub` for the transaction so triggers see `auth.uid()`
(`apps/api/src/db.ts`). The role is unchanged.

## Proposal

`actAs` also runs `SET LOCAL ROLE authenticated`, so API transactions get the
same RLS and grants as PowerSync uploads. Membership checks in code stay as
the early, friendly error; RLS becomes the backstop.

## First step: audit

What the API writes today (non-test code):

| Table           | Writes                   |
|-----------------|--------------------------|
| `chats`         | insert, update           |
| `chat_messages` | insert                   |
| `recipes`       | insert, update           |
| `variants`      | insert                   |
| `planned_meals` | insert, update, delete   |
| `list_items`    | insert, update, delete   |

For each: does `authenticated` have the grant and a policy that allows it?
Where the answer is "not for clients", a narrow `security definer` function is
the alternative to widening client rights.

Also:

- Reads and writes outside `inTransaction` (`pool.query`, raw `pool.connect`
  in `routes/chats.ts`, `adjust-planned-meal.ts`, `import-and-plan.ts`,
  `chat-variants.ts`, `plan.ts`) would still bypass RLS. They need to move
  into a user transaction or be listed as deliberate exceptions.
- Advisory locks (`pg_advisory_xact_lock`) work under any role.
- API tests that use connection-private temp tables run as `postgres`; tests
  for this change need the real schema, like `act-as.test.ts`.

## Consequences

- One authorization model for both write paths.
- Some server-only writes need explicit functions, which documents them.
- Every API query pays RLS cost; `is_list_member` is an indexed lookup.

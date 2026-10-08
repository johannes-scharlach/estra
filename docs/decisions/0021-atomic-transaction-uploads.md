# 21. Upload each local transaction atomically

Date: 2026-10-06
Status: Proposed

## Context

One user action can be several row writes. `movePlannedMeal`
(`apps/mobile/src/db/planned-meals.ts:245`) is one local `writeTransaction`,
but `uploadData` (`apps/mobile/src/db/connector.ts:45`) sends each CRUD op as
its own PostgREST request. The server sees every intermediate state.

Two consequences:

- **Partial transactions today.** If op 2 of 3 fails with a fatal code
  (`FATAL_PG_CODES`), op 1 stays applied and the rest is discarded. The server
  can hold a state no client ever had.
- **Server-side interpretation is blind.** Meal-planning activity (planned,
  changed, replaced, moved, removed; see "Meal-planning activity" below) is
  derived by a trigger on `planned_meals`. A swap uploads as two PATCHes:

  | After            | Thu | Fri | Per-op trigger sees                    |
  |------------------|-----|-----|----------------------------------------|
  | start            | X   | Y   |                                        |
  | PATCH Fri → X    | X   | X   | X arrives at Fri; Y gone everywhere    |
  | PATCH Thu → Y    | Y   | X   | Y arrives at Thu; X still at Fri       |

  `content_id` is not unique, so the middle row really exists. Naive rules
  report "Pasta removed" then "Pasta planned".

PowerSync's guidance: `getNextCrudTransaction()` exists so a backend can apply
related changes atomically (we already call it, then ignore the grouping).
The alternative it offers, intent via `_metadata` or insert-only operation
tables, would let clients assert activity facts, which ADR 18 forbids.

## Proposal

- An RPC (working name `apply_crud(ops jsonb)`), `security invoker` so RLS and
  grants apply exactly as today. It applies PUT/PATCH/DELETE for an allowlist
  of synced tables in one Postgres transaction and must match current
  PostgREST behavior: upsert on `id`; insert-only (`ignoreDuplicates`) for
  `lists`, `list_members`, `household_profiles`, `household_people`; PATCH sets
  only the sent columns; empty PATCH is a no-op. `decodeForUpload` stays
  client-side.
- `uploadData` sends the whole transaction in one call. Fatal-vs-retry
  handling stays, but now drops all or nothing.
- Meal activity moves to a commit-time (deferred constraint) trigger that
  compares `content_id → slot` before and after the transaction. Swaps then
  become one "swapped" activity; moves no longer depend on insert-before-delete
  ordering.

Open: all transactions or only those touching `planned_meals`? All is simpler
and fixes partial transactions everywhere; blast radius is every write.

## Until then

Meal activity uses per-op rules that stay quiet on swaps, without detecting
them and without activity history (so pre-launch meals behave):

- INSERT: meal (`content_id`) also in another slot → moved; else planned.
- UPDATE, same `content_id`: `variant_id` or `name` changed → changed.
- UPDATE, different `content_id`: incoming meal also in another slot, or
  outgoing meal still in another slot → quiet (half a swap); else replaced.
- DELETE: meal still in another slot → quiet (second half of a move); else
  removed.

DB tests replay the client's exact op sequences, so a change to
`movePlannedMeal`'s write order fails a test.

## Meal-planning activity (context for this ADR)

Shaped 2026-10-06, not yet specced. Slice 1 in-app, slice 2 push.

- Every other member is told when a meal is planned, changed (chat edit or
  Adjust: `repointMealVariant` in `apps/api/src/reconcile-meal-shopping.ts:63`
  keeps `content_id`, changes `variant_id`; written-meal rename), replaced,
  moved, swapped or removed. Shop swaps (`ingredient_swaps`) and eater changes
  are quiet. Past slots are skipped.
- Actor comes from `auth.uid()`. The API (`apps/api/src/plan.ts`, chat tools)
  writes through a `pg` pool without user claims, so it must set them in its
  transaction. A `planned_by` column was rejected: it can't attribute a move or
  removal by someone else.
- Activity stores `content_id` and snapshots (meal name, slot), like
  `actor_name` today (ADR 18). Tap opens the Meals tab on that day.
- Push reuses ADR 19 delivery rows, created in the same transaction. Uploads
  bypass any Edge Function, so the trigger calls the same `pg_net` request the
  cron uses for immediate dispatch (sent only after commit). Copy is rendered
  at send time in the recipient's time zone, stored per `push_devices` row.
- Copy: title is the new slot state, body is what is there, then where it came
  from, then who. Relative days for today/tomorrow. A pure formatter, twinned
  in `supabase/functions/_shared/` and the app, tested against one case table.

  | Kind     | Title                               | Body                                               |
  |----------|-------------------------------------|----------------------------------------------------|
  | Planned  | Tomorrow's dinner                   | Lasagne with lamb's lettuce · Anna                 |
  | Changed  | Tomorrow's dinner                   | Vegan lasagne, was Lasagne · Anna                  |
  | Replaced | Thursday's dinner                   | Pasta, instead of Lasagne · Anna                   |
  | Moved    | Tomorrow's lunch                    | Lasagne, moved from today's dinner · Anna          |
  | Swapped  | Today's dinner and tomorrow's lunch | Pasta today, Lasagne tomorrow · swapped by Anna    |
  | Removed  | Thursday's dinner                   | Lasagne removed · Anna                             |

## References

- ADR 15 (`content_id`, moves), ADR 18 (activities), ADR 19 (delivery).
- `docs/specs/0006-household-activity.md`, `0007-household-join-notifications.md`.
- `supabase/migrations/20260929140000_push_notifications.sql` (delivery rows,
  cron dispatch), `20260923100000_written_meals.sql` (`content_id`).
- `apps/mobile/src/features/notifications/provider.tsx`,
  `supabase/functions/_shared/notification-delivery.ts` (join-only copy and
  routing today).
- https://docs.powersync.com/client-sdks/reference/react-native-and-expo
  (`getNextCrudTransaction` vs `getCrudBatch`),
  https://docs.powersync.com/handling-writes/custom-conflict-resolution
  (`_metadata`, operation tables).

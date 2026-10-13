# Meal-planning activity

Shaped in conversation, 2026-10-06. Context and the swap problem: ADR 21
(Proposed). Two slices: in-app (done), then push.

## Behavior

1. When someone plans, changes, replaces, moves or removes a meal, every other
   current member gets one activity. The actor gets none.
   - **Planned:** a meal (`content_id`) appears that isn't in another slot.
   - **Changed:** same meal, same slot, new `variant_id` (chat edit, Adjust) or
     new written-meal `name`.
   - **Replaced:** a slot gets a new meal and the old one is gone.
   - **Moved:** a meal appears in a slot while still in its old one (the client
     inserts before it deletes).
   - **Removed:** a meal is deleted and isn't in another slot.
2. Quiet: swaps (ADR 21), `ingredient_swaps`, eaters, extra portions, the
   second half of a move, and upload retries that change nothing.
3. Activities are written by an `after` trigger on `planned_meals` in the same
   transaction as the change. Actor is `auth.uid()`. No `auth.uid()`, no
   activity. The API sets the user's claims in its transactions, so chat
   planning and edits are attributed. A failing activity is logged as a
   warning and skipped; it never fails the meal write.
4. Activities snapshot what the row shows: meal name, slot date and meal, and
   for changed/replaced the previous name, for moved the previous slot.
5. Text reads slot first, then what is there, then where it came from, then
   who. Relative days for today and tomorrow, weekday otherwise. No household
   name.

   | Kind     | Title             | Body                                      |
   |----------|-------------------|-------------------------------------------|
   | Planned  | Tomorrow's dinner | Lasagne with lamb's lettuce · Anna        |
   | Changed  | Tomorrow's dinner | Vegan lasagne, was Lasagne · Anna         |
   | Changed  | Tomorrow's dinner | Lasagne, recipe changed · Anna            |
   | Replaced | Thursday's dinner | Pasta, instead of Lasagne · Anna          |
   | Moved    | Tomorrow's lunch  | Lasagne, moved from today's dinner · Anna |
   | Moved    | Tomorrow's dinner | Lasagne, moved from today · Anna          |
   | Removed  | Thursday's dinner | Lasagne removed · Anna                    |

6. Tapping a row or a push opens the Meals tab on that day. Seen state, Home
   preview and history work as in spec 0006.
7. Not in scope: swaps, skipping past slots.

## Slice 1: in-app (done)

Trigger, snapshot columns, API `actAs`, `mealActivityText` in
`apps/mobile/src/features/activity/meal-activity-text.ts`, feed rows, Meals
`date` param. Tests: `supabase/tests/meal-activity.sql`,
`apps/api/src/act-as.test.ts`, `meal-activity-text.test.ts`.

## Slice 2: push (built; device check pending)

Migration `20261006120000_meal_activity_push.sql` (deliveries in the trigger,
`request_notification_dispatch()`, `push_devices.time_zone`, claim returns the
snapshot), `_shared/meal-activity-text.ts`, `pushMessage`, mobile
`notification-route.ts`.

1. Every activity in behavior 1 also creates `notification_deliveries` for the
   recipients' active devices, in the same transaction, as joins do (ADR 19).
   Existing cancellation applies: seeing the activity in-app, leaving the
   household, signing out or the device changing account cancels a pending
   push. Retries and receipts follow ADR 19.
2. Delivery is immediate. Uploads reach Postgres without an Edge Function, so
   the trigger requests the worker itself. The cron job's `net.http_post` moves
   into one function used by both; it stays inert without the Vault secrets.
   pg_net sends after commit, so a rolled-back write sends nothing.
3. Push text is the table above, rendered by the worker at send time, so a
   retry hours later still names the right day. "Today" and "tomorrow" use the
   device's time zone, stored on `push_devices` at registration. Without a
   time zone, use weekdays only: a weekday follows from the date alone and is
   never wrong.
4. The formatter is twinned: `supabase/functions/_shared/` (Deno) and the
   mobile one. Both are tested against the same cases.
5. The payload keeps `type: "household_activity"`, `listId`, `activityId`,
   `userId`, and adds `kind` and `slotDate`. A tapped meal push switches to
   its household and opens Meals on that day. Join pushes keep their route.

### Tests, in the order to write them

One at a time: red, green, refactor.

1. DB: A plans a meal → one delivery for B's active device, none for A's.
2. DB: planning queues one worker request when the Vault secrets exist.
3. DB (`push-devices.sql`): registration stores the time zone.
4. Deno: the meal copy table, including the no-time-zone fallback, and the
   join copy unchanged.
5. Mobile: tapping a meal push routes to Meals on its day, if that routing
   has a pure seam. Otherwise verify on a device.

### Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm --filter mobile test`,
  `pnpm supabase test db`, Deno tests for `_shared/`.
- Development build on two physical devices: plan, change, replace, move and
  remove as one account; the other gets one push each, none for a swap. Tap
  with the app foregrounded, backgrounded and terminated: Meals opens on the
  right day.
- See the activity in-app before the push sends (airplane mode on the
  recipient): the pending push is cancelled.

## Release

Slice 1: apply the migration, owner runs `pnpm sync:reload`, deploy the API,
ship mobile.

Slice 2: apply the migration, deploy `notification-worker`, ship mobile (it
sends the time zone). Meal pushes need the Vault secrets from spec 0007
(`notification_worker_url`, `notification_worker_secret`, matching the
function's `NOTIFICATION_WORKER_SECRET`); without them deliveries stay
`pending`. Joins hide a missing setup because `join-list` calls the worker
itself.

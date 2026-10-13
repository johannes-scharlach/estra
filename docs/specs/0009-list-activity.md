# List activity: added and bought

Shaped in conversation, 2026-10-09. Grouping: ADR 24. Delivery: ADR 19.

## Behavior

1. When someone adds items to the List or checks them off, every other
   current member gets one activity per batch, in-app and as a push. The
   actor gets none.
   - **Added:** a row is inserted active, or a purchased row turns active
     (re-adding from recent). Meal shopping reviews count.
   - **Bought:** an active row turns purchased.
2. One person's writes of one kind group into one open activity. Each write
   extends it by the quiet window: 5 minutes for added, 15 for bought. The
   push sends when the window passes.
3. Undo inside the window removes the name: a bought row turned active again,
   or an added row deleted. An empty activity is deleted, so a mis-tap
   sends nothing.
4. Quiet: renames, specs, categories, swaps, upload retries that change
   nothing, writes without `auth.uid()`.
5. Text, what first, then who. No household name. Up to three names, then
   `+N`.

   | Kind   | Title             | Body                         |
   |--------|-------------------|------------------------------|
   | Added  | Added to the List | Milk · Anna                  |
   | Added  | Added to the List | Milk, eggs, lemons +3 · Anna |
   | Bought | Shopping done     | 1 item bought · Anna         |
   | Bought | Shopping done     | 12 items bought · Anna       |

6. Tapping a row or a push opens the Shop tab. Seen state, Home preview and
   history work as in spec 0006.
7. Not in scope: "going shopping" announcements, items left on the List.

## Build (built; device check pending)

Migration: `household_activities.item_names` (jsonb array) and `closes_at`,
two kinds, an `after` trigger on `list_items` like `record_meal_activity`
(errors are logged and skipped), claim returns `item_names`, cron every minute.
`listActivityText` twinned in `supabase/functions/_shared/` and
`apps/mobile/src/features/activity/`. Payload keeps `type`, `listId`,
`activityId`, `userId`, `kind`.

### Tests, in the order to write them

One at a time: red, green, refactor. DB tests in `supabase/tests/list-activity.sql`.

1. DB: A adds two items → one `items_added` for B with both names, B's
   delivery due at `closes_at`, five minutes out.
2. DB: A checks off an item → `items_bought`, due fifteen minutes out.
3. DB: unticking inside the window removes the name; the last one deletes
   the activity and its delivery.
4. DB: a write after `closes_at` starts a new activity.
5. Deno and mobile: the text table.
6. Mobile: a list push routes to the Shop tab.

### Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm --filter mobile test`,
  `pnpm supabase test db`, Deno tests for `_shared/`.
- Two physical devices: add three items as one account; the other gets one
  push about five minutes later. Check off items in a few bursts; one push
  about 15 minutes after the last. Tick and untick one item; no push.
  Tap a push with the app foregrounded, backgrounded and terminated: Shop opens.

## Release

Apply the migration, owner runs `pnpm sync:reload`, deploy
`notification-worker`, ship mobile. Older builds show unknown kinds; ship
mobile before or with the migration.

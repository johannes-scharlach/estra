# Meal reminders

Shaped in conversation, 2026-10-09. Design: ADR 25. Delivery: ADR 19.

## Behavior

1. At 8:00 in each device's time zone, every member hears about today. No
   off switch yet; the OS can silence the app.
2. A planned day always gets a reminder: time to take something out of the
   freezer or shop. Any planned slot counts.
3. An empty day gets one on the two days after the last planned day, then on
   the first day of the household's usual block: Monday if the last planned
   day was a weekday, Saturday if it was a weekend. That covers weekday cooks,
   weekend cooks and holidays without nagging. Never planned: Mondays.
4. Text:

   | Day          | Title            | Body                                                  |
   |--------------|------------------|-------------------------------------------------------|
   | One meal     | Today's dinner   | Lasagne · 2 items still to buy                        |
   | Several      | Today            | Lunch: Soup · Dinner: Lasagne · 2 items still to buy  |
   | Empty        | Tonight's dinner | One of seven lines, rotating by date                  |

   Items to buy are active List items of today's meals; none, no mention.
   The empty-day lines are in `_shared/meal-reminder-text.ts`.
5. Tapping opens Meals on that day.
6. Reminders stay out of the activity feed. Devices without a time zone
   (older builds) get none.
7. Not in scope: off switch, per-meal reminders, smarter copy (last meal,
   weekday).

## Build (built; device check pending)

Migration `20261010100000_meal_reminders.sql`: `empty_day_reminder_due`,
`notification_deliveries.reminder_date`, `queue_meal_reminders(now_at)`, cron
queues before dispatch, claim returns `day_meals` and `items_to_buy`.
`_shared/meal-reminder-text.ts`, `pushMessage` case. Payload as for meals,
`activityId` null; mobile routing needed no change.

Tests: `supabase/tests/meal-reminders.sql` (rule table, queueing window and
reruns, household rhythm, claim), `_shared/meal-reminder-text.test.ts`,
`notification-delivery.test.ts`.

### Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm --filter mobile test`,
  `pnpm supabase test db`, Deno tests for `_shared/`.
- Device: a planned day pushes shortly after 8:00 with the right meals and
  item count; tapping opens Meals on today. An empty day the day after the
  last planned one pushes the invite. Nothing shows in the activity feed.

## Release

Deploy `notification-worker` first: an old worker would send reminders as
broken meal pushes, while the new one works with the old schema. Then apply
the migration and run `pnpm db:types`. No sync or mobile
change needed. Needs the Vault secrets from spec 0007.

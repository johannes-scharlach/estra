# 25. Meal reminders are deliveries, not activities

Date: 2026-10-10
Status: Accepted
Amends: 19 (a delivery can be about a day instead of an activity)

## Context

A morning reminder about the day's meals has no actor, nothing to mark seen,
and no place in the activity feed, which shows what others did. Writing it
as an activity would need a fake actor, a feed filter and a sync exception.

## Decision

- `notification_deliveries` points at either an activity (with its
  recipient) or a `reminder_date`, never both. A unique index on
  `(device_id, list_id, reminder_date)` queues each reminder once.
- The every-minute cron job runs `queue_meal_reminders()` first. It queues a
  reminder for each active device whose time zone Postgres knows and whose
  local time is 8:00–8:59, for every household the user belongs to. The hour
  covers missed runs. Devices without a time zone get none.
- Planned days always qualify. An empty day qualifies by
  `empty_day_reminder_due(day, last_planned)`: the two days after the last
  planned day, then the first day of that household's block, Monday for
  weekday cooks and Saturday for weekend cooks. Never planned: Mondays.
- The claim reads the day at send time: its meals in slot order and how many
  of their List items are still active. Nothing is snapshotted.
- Leaving, signing out or reassigning the device cancels as before. There is
  no seen state, so nothing else cancels a reminder.

## Consequences

Reminders never reach clients' local databases. The claim's eligibility check
no longer joins recipients. Retries end about five hours after 8:00, so the
text can always say "today". A device in another time zone than its
household hears at its own 8:00, about its own date.

# 24. List activities stay open until a quiet window passes

Date: 2026-10-09
Status: Accepted
Amends: 18 (an activity can grow while open)

## Context

Adding to and checking off the List happens item by item. One activity and
one push per row would bury the household in noise. Others care about the
outcome: what was added, and that the shopping is done.

## Decision

- `items_added` and `items_bought` activities group one person's writes.
  Each write appends the item's name to the person's open activity of that
  kind and moves its `closes_at` to now plus a quiet window: 5 minutes for
  added, 15 for bought. With no open activity, the write starts one.
- Pending deliveries of an open activity are due at `closes_at`, so the push
  sends once the person stops. A write after `closes_at` starts a new
  activity.
- Undoing inside the window (unticking a bought item, deleting an added one)
  removes the name. An activity left empty is deleted with its deliveries.
- Recipients are fixed when the activity starts. Seeing an open activity
  cancels the pending push as in ADR 19; later names still show in-app.
- Cron checks for due work every minute instead of every five, so a push
  lands within a minute of its window closing. The check is the same indexed
  `EXISTS`; the worker still runs only when work is due.

## Consequences

An activity is a fact only once closed; until then it is a growing snapshot.
Names are distinct per activity, so two meals' onions count once. Offline
check-offs that upload together group by upload time, not purchase time.

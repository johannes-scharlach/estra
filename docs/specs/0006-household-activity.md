# Household activity: joining

Approved in conversation, 2026-09-29. Data decision: ADR 18.

## Behavior

1. A successful new household join creates one `member_joined` activity and
   recipient records for the other members, atomically with the join. Failed
   joins, retries, reopening the invitation and linking an existing member's
   person produce no extra activity. Existing membership is not backfilled.
2. Home shows the latest three activities addressed to the current user in the
   active household, below "Start from an idea". Hide the section when empty.
   "See all" appears when there are more than three and opens a pushed history
   screen. Both lists use newest-first order with an ID tie-breaker.
3. Show the person's name at the time of joining and the activity time. A tap
   marks that specific activity seen and opens Household.
4. Mark a row seen after it is at least half visible continuously for one second
   while the screen is focused and the app is active. Downloading, mounting,
   opening Home or opening history does not mark unseen rows offscreen.
   Scrolling out of view, leaving the screen or backgrounding interrupts the
   exposure. Pause exposure while the keyboard is open or Android loses window
   focus. The native adapter intersects measured cell positions with the scroll
   frame and navigation/tab-bar safe bounds; it does not use FlatList's raw
   viewport for seen state. `ActivityVisit` owns duration and visit rules.
5. A new dot stays stable through the current foreground screen visit, even if
   seen state syncs during it. On the next visit, use the current seen state.
   Marking seen neither removes nor reorders a row.
6. Seen state is per recipient and per activity, works offline and syncs across
   devices. Only `seen_at` is client-writable; clients cannot create activities,
   add recipients, rewrite attribution or inspect other members' seen state.
7. First slice: household joins and in-app activity. Push delivery, scheduling,
   meal-planning activity and shopping activity follow separately.

## Verification

- Pure mobile tests exercise `ActivityVisit`: exposure duration, interrupted
  exposure, per-row eligibility, synced seen state and stable visit styling.
- Run `pnpm typecheck`, `pnpm lint`, and `pnpm --filter mobile test`.
- Existing invitation checks: `pnpm supabase test db supabase/tests/household-invitations.sql`
  after applying the migration. They protect the invitation flow, not native UI.
- On iOS and Android, join from a second account. Existing members see the
  entry; the joining account does not see its own join. Retry/reopen the link.
- Leave the section below the fold: it stays unseen. Scroll a row less than
  halfway into view, then at least halfway for less than one second, then for
  a full second. Only the last exposure marks it seen.
- Interrupt exposure with a tab switch, pushed screen, backgrounding, keyboard,
  or Android notification shade. Returning requires a fresh full second.
- With more than three activities, verify "See all", unseen older rows, stable
  row positions/dots and history scrolling. Test larger text and rotation.
- Verify ingredient/dish typing still scrolls the Home entry above the keyboard,
  its inputs keep focus, and the large navigation title still collapses.
- Mark an activity seen offline, reconnect and check a second device. Switch
  households/accounts: no prior household/account rows should flash or be marked.

## Release

Apply `20260929100000_household_activities.sql`, deploy the updated PowerSync
sync configuration, then ship the mobile changes. For local development,
the owner reloads PowerSync with `pnpm sync:reload` after applying the migration.
No edge-function or API-server change is needed.

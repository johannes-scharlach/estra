# 19. Durable push notification delivery

Date: 2026-09-29
Status: Accepted

Use Expo Push Service and Supabase Edge Functions for push delivery. Notification
volume is expected to be near zero, so a continuously running worker is not
justified. The runtime is replaceable: durable delivery state and atomic claims
live in Postgres rather than in an Edge Function process.

`push_devices` assigns an Expo token to one user installation. Tokens are never
synced or directly readable by clients. Authenticated clients use narrow
registration functions; signing out disables that installation. Expo's
`DeviceNotRegistered` result also disables it.

`notification_deliveries` represents one activity-recipient-device delivery.
Household invite acceptance creates these rows in the same transaction as the
membership, activity, and recipient rows. A join is immediately eligible. The
join Edge Function attempts a bounded batch after commit, but failure never
changes the successful join response.

Workers atomically claim at most 100 due rows with a short lease and
`FOR UPDATE SKIP LOCKED`. Before claiming an unsent row, Postgres cancels it if
the activity was seen, membership ended, the device was disabled, or the device
now belongs to another user. This makes immediate and recovery dispatch safe to
overlap.

Transient send failures retry after 1, 5, 15, 60, and 240 minutes, then fail
after a maximum of six send attempts.
Accepted Expo tickets are checked after 15 minutes. Missing receipts are checked
again every 15 minutes and fail before Expo's 24-hour receipt retention ends.
Permanent errors do not retry.

A five-minute `pg_cron` job first runs an indexed `EXISTS` query. It invokes the
recovery function through `pg_net` only when work is due and both worker URL and
secret exist in Vault. This avoids idle Edge Function invocations. No app-level
quiet hours are added; device Focus and Do Not Disturb own interruption.

# 10. The API owns import and plan

Date: 2026-09-08
Status: Accepted

Shopping amendment: [ADR 16](0016-intentional-meal-shopping.md) removes automatic
ingredient additions. Import still saves and plans atomically.

Importing a URL for a meal slot is one operation. The API saves the recipe,
variant, planned meal, and meal-derived shopping items in one Postgres
transaction, reusing the existing server planning function. The client does
not wait for the variant to sync and then issue a second planning write.

The native form sheet dismisses on valid submission. An in-memory operation
outside the screen tracks progress by list, date, and slot until the planned
meal and variant arrive locally. Errors appear in that slot with retry and
dismiss actions. Progress survives navigation, but is not persisted across
app termination. This is not a durable background job system.

Retries reuse an operation UUID on the import request, separate from its
optional plan target. The exact imported variant ID is derived from the caller,
operation UUID, and import inputs via `estraUuidV5`. Recipes remain random
grouping IDs. Looking up that exact variant recognizes a completed import even
if the recipe later has additional variants. This applies to cookbook imports
as well as import and plan. Concurrent
retries serialize before writing. Imports only fill empty server slots; an
occupied slot causes the whole transaction to roll back. This checks committed
server state, not pending offline changes on other devices.

An `ImportJobs` class owns client state with injected import, sync, and feedback
functions. A saved result is retained after a sync failure, so retry only waits
for sync. Typed server errors serialize as `{ error: { code, message } }`; the
client uses codes to distinguish retryable failures from errors requiring a
new target or URL.

The outer operation owns the transaction. Persistence functions require its
client, variant insertion requires an existing recipe ID, and planning requires
an explicit reject-or-replace policy.

Planning an existing cookbook recipe remains a local transaction for offline
use. Both paths retain the same slot IDs and ingredient projection rules.

# 18. Household activities and personal seen state

Date: 2026-09-29
Status: Accepted

Activities record facts; recipients record who should know and whether they
have seen them. These are separate from future scheduled notification delivery.
An in-app activity remains useful even when no push is sent.

`household_activities` is server-written and household-readable. Joining through
`accept_household_invite` writes the fact and recipients in the same transaction
as membership and person linking. Recipients are the other current members, not
only the inviter. Retries and linking a person for an existing member create no
new activity. Names are snapshots so history survives renaming or leaving.

`household_activity_recipients` is personal: only its recipient can read it or
update `seen_at`. Its denormalized `list_id` keeps sync and RLS membership-scoped;
composite foreign keys enforce the activity's household and current membership.
Leaving removes that person's recipient state, not the shared activity. A seen
timestamp, once accepted, cannot be cleared or replaced by a later offline write.

We store seen state per activity rather than one "last seen" cursor: seeing the
three Home entries says nothing about older activities behind "See all". Local
seen writes sync normally through PowerSync. Visibility and stable styling for
the current visit live behind the mobile `ActivityVisit` interface.

Future scheduling must create delivery work atomically with the activity or
derive it recoverably. Joins are eligible immediately. Device Focus/Do Not
Disturb controls interruption; Estra has no quiet-hours scheduler. Pending
delivery can check recipient membership and seen state before sending.

Behavior and release checks: `docs/specs/0006-household-activity.md`.

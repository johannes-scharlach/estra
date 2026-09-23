# 11. Cooking Profiles belong to lists

Date: 2026-09-15
Status: Accepted; data structure approved by product owner

## Decision

A list represents a household. `household_profiles.id` references `lists.id`
and is the Profile's primary key. List membership controls access and sync.
Household people are separate `household_people` rows, each with a stable
UUID and optional `user_id`. A composite foreign key to list membership and
a unique `(list_id, user_id)` enforce that an account identifies at most one
person in that household. Leaving clears the link but retains the person.
Deleting a list cascades to its Profile and people.

The Profile uses separate columns for each selection group, household
restrictions, shopping notes, and meal routine. Selection groups are JSON
objects containing preset boolean keys and an `other` string array. Missing
keys are unselected. Meal routine is one of the setup presets. Selecting
`It varies` allows a household to supply its changing-pattern detail.

Before authentication a versioned device-local draft stores answers, progress,
the onboarding person's ID, and stable finalization IDs. Person IDs do not
require accounts. Verification links that person to the User. Related local
PowerSync writes are atomic; normal upload/retry follows without a server-save
gate on completion.

## Consequences

- One Profile per list, including when setup is retried.
- Editing one Profile column or one person does not replace other sections or
  people. Concurrent edits to the same field use normal sync conflict behavior.
- Draft storage must be independent of the PowerSync cache cleared on sign-out.
- Invitations and linking other accounts remain future work.
- Stored preset keys support future localization; localization is out of scope.

Full behavior: `docs/specs/0003-profile-onboarding.md`.

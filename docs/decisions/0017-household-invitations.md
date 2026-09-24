# 17. Reusable household invitations

Date: 2026-09-25
Status: Accepted

## Decision

Any household member can share one reusable link in a family chat. The link
has no expiry and can be reset by any member. Anyone holding it can join.
Resetting prevents future joins through the old link; it does not remove members.

After signing in, recipients identify themselves by selecting an unlinked
household person or entering their name. Every joining account becomes an
eater. Preserve the existing person's cooking details when linking an account.

Keep the existing `lists.invite_code` rather than introduce invitation rows.
Postgres generates a random 128-bit secret on list insertion. Sharing reads
the authoritative code online, so a not-yet-uploaded household cannot share a
nonexistent invitation. Reset also runs online.

The `join-list` edge function verifies authentication and calls narrow
SECURITY DEFINER functions with the caller's JWT. Preview exposes only household
name and unlinked person names/ids. Acceptance locks the list row, inserts
membership and links/creates the person in one transaction. This serializes
competing claims, retries by one account, and link resets. No service-role
client is needed.

## Consequences

- The pending code lives in device storage independently of the auth/sync
  cache. An invitation gates normal onboarding until accepted or dismissed.
- After acceptance, wait for the destination list, membership, profile and
  linked person locally before making it active and lifting the gate.
- Existing linked members opening the same link go straight to that household.
- Per user approval, Fly serves a public `/join/:code` installation handoff.
  This is a static landing page, not a web version of the app. Invitation
  validation and joining remain in Supabase (ADR 5).
- The page opens `estra://join?code=…`; first-time installs return through the
  original message. No deferred deep-link service or domain association is
  required. Native builds register the scheme; Expo Go does not.
- Landing pages contain no household data, use no-store/no-referrer headers,
  and their secret-bearing paths are omitted from the application request log.
- The migration replaces earlier short/list-id-derived codes. No new synced
  columns or tables are needed. Existing PowerSync membership rules deliver
  the newly joined household.

Behavior and release checks: `docs/specs/0005-household-invitations.md`.

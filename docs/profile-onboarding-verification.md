# Household Profile rollout and native verification

Implementation spec: `specs/0003-profile-onboarding.md`.
Data decision: `decisions/0011-household-profiles.md`.

## Apply to the development stack

The implementation does not apply migrations or restart the user's services.
When ready, apply pending migrations with `pnpm supabase migration up --local`
and reload sync rules with `pnpm sync:reload`. Regenerate database types with
`pnpm db:types` after applying the migration. The committed type mirror was
updated alongside the migration; regeneration confirms the backend's output.

The local auth configuration enables email confirmation and uses
`supabase/templates/email-code.html` for both signup and returning sign-in.
The running Supabase auth service needs its configuration reloaded through
the user's normal stack workflow. For hosted Supabase, configure the same
confirmation and magic-link templates (using `{{ .Token }}`), six-digit OTP,
and SMTP delivery in that project's auth settings. SQL migrations do not
deploy hosted email settings.

AsyncStorage 2.2.0 matches Expo SDK 57's bundled native version. A development
binary built without this module needs to be rebuilt by the user.

## Automated checks

- `pnpm typecheck`
- `pnpm lint`
- `pnpm --filter mobile test`
- `pnpm --filter api test`

Draft restoration and finalization are exercised at their public boundaries.
Finalization tests use real in-memory SQLite transactions: rollback on failure,
retry, preservation of subsequent edits, and account-binding rejection. These
tests do not verify Postgres RLS or PowerSync delivery.

## Native acceptance pass (pending)

Use the spec's complete manual acceptance list, especially:

- Fresh install: complete all eleven steps, custom entries, multiple people,
  explicit empty equipment, and a weekday/weekend meal routine.
- Restart while typing, between steps, and on the code screen. Confirm answers
  survive, saved people survive, cancelled person edits do not, and OTP does not.
  Use native Back/swipe after resuming to revisit earlier questions.
- Wrong code, expiry, resend, corrected email, returning email at signup, unknown
  email on Sign in, and a stored session without a Profile.
- Interrupt finalization and reconnect. Verify one list, one creator membership,
  one Profile and one linked creator. Check the upload queue drains successfully.
- On another list-member account, inspect/edit the same Profile. A nonmember
  must not read, mutate, or sync either Profile table. Removing membership must
  clear the person's account link while preserving their cooking details.
- Save one Profile section while another device edits a different section.
  Verify both survive. Cancel a person edit and test removing a custom entry.
- Send a message immediately after setup and after an edit in an existing chat.
  Verify that context uses that chat's household, latest routine/restrictions,
  category labels rather than examples, and the correct serving baseline.
- iOS and Android: keyboard visibility, six-digit paste/autofill, native switch
  and picker sizing, screen readers, larger text, back gestures, and safe areas.
- Motion: native wizard pushes/back gestures, progress changes, reduced motion.
  Judge smoothness in a release build on the slowest supported device.

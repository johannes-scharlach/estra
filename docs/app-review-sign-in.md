# App Review sign-in

Returning-user sign-in uses a password only for
`johannes.scharlach+apple@gmail.com` (ignoring case and surrounding whitespace).
The email selects the password screen without requesting an OTP. Supabase
still verifies the password and issues a normal session. Signup and every
other returning-user address keep the existing OTP flow.

## Production account setup (required before review)

No production account or data is created by this change. Keep the existing
review account and household; a password can be added after OTP signup.

From the repo root, run this in an interactive terminal:

```sh
pnpm --filter mobile exec node scripts/set-review-password.mjs
```

1. Enter the HTTPS Supabase project URL and its **publishable/anon key**, from
   the same project used by the built iOS app. Secret/service-role keys are
   rejected. The helper does not read environment files or accept arguments.
2. Check the displayed project and review email before confirming. This sends
   an OTP for the existing user only; it never creates a user.
3. Enter the six-digit email code, then a unique app password of at least 12
   characters and its confirmation. This is not the Gmail password. Supabase's
   own password policy also applies.
4. Sign out, then sign in with that email and password in the built iOS app.
   The user ID and household membership are preserved; there is no app rebuild
   or data migration.

The key, OTP, and passwords are hidden while typing. They are not written to
files, command arguments, terminal output, or readline history. The temporary
session stays in memory; the helper attempts to revoke it with local scope
when exiting normally. Ctrl+C cancels prompts; if a request is already in
flight, it can still finish. Do not paste credentials into chat or pass them
on the command line.

- Give this normal user its own sample household, complete setup, and add
  representative recipes, meals, and List items if not already done. Do not
  use customer data.
- Keep credentials and backend services usable for subsequent reviews. Verify
  sign-in in the submitted production build, not only a development build.

## App Store Connect

Provide the review email and app password in the sign-in credentials fields.
Include these steps in Notes for Review:

> From the welcome screen, choose Sign in. Enter the supplied review email and
> tap Continue. This review account uses password sign-in rather than an emailed
> code. Enter the supplied app password and tap Sign in. The account has its own
> sample household and uses the same app features as other users.

## Verification

Automated coverage tests the email-routing rule in
`apps/mobile/src/features/onboarding/sign-in-method.test.ts`.

Native acceptance checks (pending, on iOS and Android):

- Enter the review email, including mixed case and surrounding whitespace.
  Both Continue and keyboard submission must open the password screen without
  sending an email.
- Check the secure password field, password autofill, keyboard visibility,
  screen-reader labels, and larger text.
- An empty password cannot submit. A wrong password shows an error and allows
  retry. Repeated submission while signing in must not start another request.
- Back, Change address, and Android Back return to the email step. Returning
  to the password step must not retain the previous password or error.
- Correct credentials load the sample household through normal PowerSync and
  permissions. Sign out and sign in again in the production build.
- Other email addresses still send and verify OTPs. Changing from the review
  email to another address must restore that flow. Signup remains unchanged.

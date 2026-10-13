# Magpie rename checklist

The repo now uses Magpie for branding, workspace packages, native app IDs,
deep links, storage keys, seed credentials, and local stack names. No running
services, hosted accounts, generated native projects, local env files, Git
remote, or checkout directory were changed.

## External setup before building or shipping

- **Expo:** EAS project slugs cannot be changed. Create/link a project with slug
  `magpie`, then set `extra.eas.projectId` to its UUID. The new Magpie project is
  `e270b2e9-0b2c-4518-9d46-2f8777b681e0`; configure its signing/push credentials.
- **Native IDs:** register `com.magpiemeals.app`, `com.magpiemeals.app.local`, and
  `com.magpiemeals.app.dev` as needed. These are separate apps, not updates to
  existing installs. Set up matching store entries and signing/push credentials.
- **Firebase:** replace `apps/mobile/google-services.json` with a fresh download
  for the new Android registrations. The existing file is intentionally intact:
  changing its package names or project ID would fabricate credentials.
  Android builds/push are blocked until it matches the new package IDs. Firebase
  project IDs and bucket names are provider identifiers, not display names;
  keeping the existing project can retain its original identifiers.
- **Fly:** confirm ownership/availability of `magpie-api` and
  `https://magpie-api.fly.dev` before building clients. Set up the app, runtime
  secrets, and repository `FLY_API_TOKEN` for that target. If the name is taken,
  update `apps/api/fly.toml`, `apps/mobile/eas.json`, and env examples to the
  actual owned endpoint. Use `MAGPIE_IOS_INSTALL_URL` and
  `MAGPIE_ANDROID_INSTALL_URL` for installation links.
- **Hosted Supabase:** update auth site/redirect URLs to `magpie://` and apply
  the Magpie email subjects/template. Local `supabase/config.toml` does not
  update hosted auth settings. Rename hosted project/service display names as
  desired; opaque Supabase, PowerSync, and analytics IDs stay unchanged.
- **GitHub/checkout:** rename the repository and local directory when ready,
  then update the Git remote. Neither is changed by this code rename.

Deployments remain the user's or CI's job.

## Local data and rebuilds

- Sync pending offline edits and back up local data before switching. The new
  app IDs, `magpie.db`, and `magpie.*` keys use separate device storage. Existing
  installs/data are not deleted or migrated, and stored legacy links are not
  rewritten. No legacy deep-link scheme is registered.
- Supabase's local project and the Compose project are now `magpie`. The new
  stack uses the same ports but separate database/Mongo volumes. Stop the old
  stack explicitly under its original project name before starting the new
  one; do not reset or delete its data. Stack commands now target Magpie.
- Newly seeded login: `dev@magpie.local` / `magpie-dev`. Existing database users
  are unchanged until the new stack is initialized.
- Update private env files as needed. Regenerate the ignored native projects
  and rebuild development clients yourself; restarting Metro alone cannot
  change app IDs or the registered URL scheme.
- The deterministic UUID namespace is unchanged in both runtimes, so the
  same inputs still produce the same persisted row IDs.

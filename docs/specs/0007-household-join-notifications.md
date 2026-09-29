# Household join notifications

## Behavior

- When someone joins a household, every existing member with an active device
  receives: household name as title and “{name} joined your household.” as body.
- The joiner does not receive the notification.
- A failed push never fails or rolls back the join.
- A pending retry is cancelled after its recipient sees the activity, leaves
  the household, signs out on that installation, or the installation changes
  account.
- Tapping the notification switches to its household and opens Household
  activity.
- After setup or joining, Estra explains notifications once before showing the
  system permission prompt. “Not now” remains available. Household settings
  provides a later opt-in path.
- Estra adds no delay or quiet hours. Device Focus and Do Not Disturb settings
  control interruption.
- Transient delivery failures make at most six send attempts. Accepted Expo
  tickets are checked after 15 minutes; missing receipts expire before 24 hours.

## Operations

Deploy `join-list` and `notification-worker`. Set the same high-entropy value as
the Edge Function secret `NOTIFICATION_WORKER_SECRET` and Vault secret
`notification_worker_secret`. Set Vault secret `notification_worker_url` to the
deployed `notification-worker` URL. `EXPO_ACCESS_TOKEN` is optional unless Expo
push access security is enabled.

Configure APNs and FCM credentials in EAS. Remote Android push is not available
in Expo Go; verify using a development build on physical iOS and Android devices.

## Verification

- Deno policy tests cover ticket timing, retry exhaustion, receipt expiry, and
  device invalidation.
- Invitation database tests cover atomic delivery creation and joiner exclusion.
- On devices: join → existing member receives push → tap → correct household
  activity opens. Repeat with app foregrounded, backgrounded, and terminated.
- Deny the initial prompt, then enable from Household settings.
- Sign out, join from another account, and confirm the signed-out installation
  receives no push.

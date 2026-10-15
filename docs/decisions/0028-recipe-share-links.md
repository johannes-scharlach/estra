# 28. Recipe share links

Date: 2026-10-15
Status: Accepted
Builds on: 17 (installation handoff), 27 (copying a variant)

## Context

A user wants to send a recipe to a friend so the friend starts using
Magpie. Plain text in the share sheet would give the recipe away without
the app.

## Decision

Share sends `https://<api>/r/<variantId>`. The variant id is the share
code: no secret, no reset, no expiry. Revocation waits until someone asks.

Opening the link in the app saves the recipe at once: there is no
preview and no Save button.

1. A copy of this variant in any of your lists (ADR 27 ids, checked
   locally) opens that copy, preferring the active household.
2. Otherwise, if the variant itself synced to you (your own link, your
   household's), it opens.
3. Otherwise `public.copy_variant_to_list` copies it into the active
   household on the server, and the copy opens once it syncs.

The link waits in device storage through sign-in and onboarding, like an
invitation, and is handled once a household is active. Tapping it again
later lands on step 1: your saved version.

The Fly page `/r/:variantId` is the installation handoff for people
without the app. Unlike ADR 17's landing page it shows recipe content:
name, description and ingredient lines, never instructions, the source
household or the sharer. It opens `magpie://shared/<variantId>`.

## Consequences

- Deleting the source turns the page into "no longer available". Saved
  copies stay.
- The page is unauthenticated and reads Postgres directly. It answers only
  for well-formed ids and serves `noindex`, `no-store` and
  `no-referrer`, like `/join`.
- `copy_variant_to_list` is `security definer`. It checks only that the
  caller belongs to the target list: holding the id is the permission.

# 27. Recipes belong to a household

Date: 2026-10-15
Status: Accepted
Amends: 8 (recipes gain a list), 10 (import names a list)

## Context

Recipes and variants are readable by every account and sync to every
device (`using (true)`). Every cookbook shows every user's recipes. The
sync config always called this an alpha shortcut.

## Decision

Every recipe belongs to exactly one list. Members of that list read,
write and delete it. A device syncs the recipes of every list its user
belongs to, and the cookbook shows all of them.

- `recipes.list_id` is required. `variants.list_id` repeats it, so both
  sync with the same one-join shape as `chat_messages`. A composite
  foreign key `(recipe_id, list_id)` keeps the two equal.
- A recipe never moves. **Planning a variant into another list plans a
  copy.** The copy is a new recipe with one variant in the target list:
  same content and ingredient ids, no `sized_for` (it named the other
  household's people), no `origin`, no `created_by` (an offline copy
  can't know it, and both sides must write the same row).
- Copy ids derive from the target list and the source variant, so
  retries, double taps and two offline devices make the same rows:
  - recipe: `magpieUuidV5(JSON.stringify(["recipe-copy", listId, variantId]))`
  - variant: `magpieUuidV5(JSON.stringify(["variant-copy", listId, variantId]))`
- `public.copy_variant_to_list` is the server copy, open to members of
  the target list. It is idempotent and returns the variant to use in the
  target list: the source itself when it already lives there. Mobile
  planning has an offline twin in `apps/mobile/src/db/recipe-copies.ts`;
  both must derive the same ids.
- New recipes take their list from where they are made: the planned slot
  or the cookbook's list on import, the chat's list on a chat save.
  Imports from app builds that send no list fall back to the creator's
  first list.
- Recipe chats live in the recipe's list. Chat tools read and search only
  the chat's list.
- Any member can delete a recipe. It takes all its variants and recipe
  chats with it. Deleting is refused while any meal in that list, past or
  future, uses one of its variants. Copies elsewhere are untouched.

## Consequences

- Existing recipes move to their creator's first list (earliest
  `joined_at`). Planned meals that point into another list are repointed
  to a copy in their own list.
- Someone in two households who plans across them sees the recipe twice in
  the cookbook, once per household. Accepted until it bothers someone.
- A variant id is enough to copy that variant (ADR 28). Variant ids are
  random and travel only inside a household, or in a link someone chose
  to share.

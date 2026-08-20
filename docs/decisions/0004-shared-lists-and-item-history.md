# 4. Membership-based access, and one table for items and history

Date: 2026-08-18
Status: Accepted

## Context

Estra is a shared shopping list in the mould of Bring!: several people on
one list, items grouped by category, and recently-bought items offered for
one-tap re-adding.

Sharing is what makes the model non-obvious. A per-user catalogue of known
items looked natural at first, until the visibility question: if
`list_items` referenced a `catalog_items` row scoped to the person who
created it, a co-shopper would sync the list item but not the thing it
points at, and would see an item with no name. **Anything referenced from a
shared row has to be visible to everyone who can see that row.**

## Decision

Access derives from `list_members`. There is no `owner_id` on content rows.

Items and their history live in one table. Checking something off sets
`status = 'purchased'` instead of deleting the row.

`list_items.id` is deterministic: `uuidv5(list_id + normalised name)`.

## Consequences

- Every RLS policy and every sync stream asks the same question: is the
  caller a member of this list? Policies use the `is_list_member(uuid)`
  SECURITY DEFINER function, because a policy on `list_members` that queries
  `list_members` recurses infinitely. That function sets an explicit
  `search_path`; without one, a caller could shadow `public` and redirect
  the lookup to tables they control.
- Deleting a shared list is restricted to its creator. This is the one place
  the flat "everyone can do everything" model is deliberately narrowed —
  the rest (add, check off, rename, invite) is open to any member.
- No catalogue table. The list's own purchased rows *are* its catalogue:
  recent suggestions, autocomplete, and remembered categories all read from
  `list_items`. Nothing can dangle, because there is nothing to reference.
- Item knowledge does not transfer between lists. Typing "oat milk" on a
  second list starts fresh. Acceptable, and arguably correct — a hardware
  list should not autocomplete groceries.
- `list_items` grows without bound and will eventually need pruning. The
  `list_items` sync stream is the one to split first if that bites: active
  items auto-subscribed, purchased on demand.
- Deterministic ids make concurrent offline adds converge. Two people adding
  "milk" with no connectivity generate the *same* id, so PowerSync's upsert
  merges them. With random ids they would race the
  `unique (list_id, name_key)` constraint, and the loser would return
  `23505` — which the connector classifies as fatal and discards, silently
  losing someone's add.
- Renaming an item leaves its id derived from the old name. Harmless (the id
  is opaque), but it means the id is not a reliable way to recompute the
  name key. `name_key` is the column of record.
- Categories are global seeded reference data with a read-only policy and an
  unparameterised sync stream, so a category assigned by one member renders
  identically for every other member.

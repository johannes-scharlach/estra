# 23. Each ingredient gets an explicit shopping decision

Date: 2026-10-08
Status: Accepted
Amends: 16 (review selection and the review marker)

## Context

The review used one checkbox for three states: undecided, to buy and already
at home. Likely purchases started checked, so a fresh review looked finished,
and nothing was saved until a button below the fold. Testers could not tell
what a check meant; on the List the same mark means "bought".

## Decision

- Every ingredient of a planned recipe is undecided, to shop, bought or at
  home. A shopping row decides it (bought once purchased). Otherwise
  `planned_meals.ingredients_at_home`, a JSON array of ingredient ids, marks
  it at home. Nothing is preselected; the AI's `shopping_hint` only orders
  the review, likely purchases first.
- Each decision saves immediately. To shop adds the meal's chosen option;
  at home removes an unbought row. Bought rows stay purchase facts. The
  control is a two-way switch, so a decision can be changed but not taken
  back to undecided.
- "Mark the other N at home" marks every undecided ingredient at home.
- A write sets `shopping_reviewed_variant_id` while nothing is undecided and
  clears it otherwise. Removing an item from the List still does not reopen
  the review (ADR 16).
- At-home marks move with a meal, are cleared when the slot is replanned, and
  are not copied when a meal is repeated: a later date is a new check.
- Ingredient ids survive rewrites (ADR 20), so marks for retained
  ingredients carry over and new ingredients start undecided.

## Consequences

Meals reviewed before this change keep their marker but show their
unbought ingredients as undecided; deciding one recomputes the marker.

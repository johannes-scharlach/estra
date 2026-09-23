# 12. A planned meal records eaters and extra portions

Date: 2026-09-18
Status: Accepted

## Decision

A planned meal stores who from the household is eating and how much extra
to cook, not a total. `planned_meals.eater_ids` is a JSON array of
`household_people` ids; `planned_meals.extra_portions` is a non-negative
number with two decimals. Both default to everyone in the household and
zero. The old `servings` total is gone; existing rows were reset to the
default rather than reinterpreted, because the total never scaled anything.

One extra portion means one adult helping of the dish. It belongs to nobody:
guests, leftovers, or just more food. This is a definition for labels and
for the assistant, not a calculation the app performs.

Quantities follow eaters in exactly one place: when the assistant writes a
recipe at save time, it sizes it for the eaters and extra the user named,
and passes the same to `planMeal`. Planning a saved recipe by hand, or
editing eaters on the card later, never rewrites the recipe or its shopping
items, and the sheet says so.

The assistant reads the household from Postgres on every turn. The client no
longer sends a household snapshot with a chat message. An edit still
uploading when a message is sent is seen one turn late.

## Consequences

- The planned-meal row stays the unit of conflict, with its deterministic
  id. No join table, so removing a person from the household leaves their
  id in old meals; readers filter unknown ids out.
- The app cannot compute "usual" attendance from the free-text
  `meal_times`; the default is everyone and the user unticks per meal.
- The plan sheet and the per-meal editor share one picker so both say the
  same thing. The chat message names the ticked people ("me" for the
  caller) and the extra, and the assistant maps names to ids from its
  household context. The tool rejects ids that are not in the household.
- Resizing an already saved recipe for different eaters is a chat ask, not
  a plan edit.

Behavior: `docs/specs/0002-household-meals-and-extra-portions.md`.

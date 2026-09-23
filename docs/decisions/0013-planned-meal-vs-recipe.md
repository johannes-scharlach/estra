# 13. The shopping list is the meal's truth; adjusting repoints

Date: 2026-09-18
Status: Accepted

## Context

A planned meal accumulates facts the recipe does not know: who is eating,
how much extra, and which ingredients were swapped on the shopping list.
Swaps are written on `list_items` by the shop page; the variant page kept
its own local, unsaved swap state; and the only recipe rewrite path, the
chat's `updateRecipe` then `planMeal`, reprojects list items and so wipes
purchased state and the very swaps that motivated the rewrite.

The rule that links a list item back to its recipe line (name equals the
line's ingredient or one of its swaps) existed on the client only. The
server-side rewrite needs it too. `plan.ts` is already a deliberate twin of
`planned-meals.ts`; a third copy of a pure rule is where twinning stops.

## Decision

- **Pending swaps live on `list_items` and nowhere else.** The variant page,
  when opened for a planned meal, reads and writes the meal's list items.
  Swapping there is the same write as swapping on the shop page.
- **Adjusting a planned meal writes a new variant and repoints without
  reprojecting.** `POST /v1/planned-meals/:id/adjust` writes a new
  `variants` row under the same recipe, sized for the meal's eaters and
  extra with the list's swaps folded in, then sets `planned_meals.variant_id`
  and `list_items.variant_id`. It never deletes or inserts list items. The
  new variant id is derived from caller, operation and planned meal, so a
  retry finds the finished result.
- **Pure rules both apps need go in `packages/`.** `@estra/meals` holds
  `itemNameKey`, `lineForItem` and `mealDelta` as plain functions over plain
  types. Persistence code stays twinned per ADR 10; rules do not.

## Consequences

- `list_items.variant_id` follows the repoint, so alternatives keep
  resolving against the version the meal now uses.
- A renamed item no longer matches a line. It is shown as "also on the
  list", not guessed. Adding a line index to `list_items` would remove that
  gap; not needed yet.
- The old variant stays browsable and shows "another version is planned".
- The chat's `updateRecipe` plus `planMeal` remains for unplanned recipes.
  For planned meals it is the wrong tool; pointing the assistant at adjust
  is a later prompt change.
- The API image must copy `packages/meals` like `packages/profile`.

Behavior: `docs/specs/0004-planned-meal-vs-recipe.md`.

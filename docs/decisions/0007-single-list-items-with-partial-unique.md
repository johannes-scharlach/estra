# 7. One list_items table with partial unique for meal-derived rows

Date: 2026-08-24
Status: Accepted

## Context

The List is now one unified list (groceries + non-food + meal-derived rows). Planning three meals that each need bell peppers should show three rows (one per PlannedMeal) because swaps are meal-dependent. This conflicts with the existing `list_items` invariant `unique(list_id, name_key)` and deterministic `uuidv5(list_id, name_key)` that powers offline converge and the Recent strip (`purchase_count` ranked `purchased` rows).

## Decision

Keep a single `list_items` table and add nullable `planned_meal_id` / `variant_id`. Replace the full unique with a partial index:

`unique(list_id, name_key) where planned_meal_id is null`

Standalone rows keep deterministic ids and dedupe; meal-derived rows use random uuids and allow duplicates. Recent queries filter `where planned_meal_id is null` so meal rows never pollute suggestions. `purchase_count` only increments for standalone rows.

## Considered Options

Two tables: keep `list_items` for standalone and add `planned_meal_items`. Recent stays pure, but doubles the 4-step sync ceremony in `docs/schema-changes.md` (migration + publication + `sync-config.yaml` + `schema.ts` + RLS) and requires a union view for the List screen.

## Consequences

- One sync stream and one RLS policy (`is_list_member`) — smallest step per docs/schema-changes.md.
- Every List/Recent query needs a `planned_meal_id is [not] null` filter; easy to forget.
- Meal deletion cascades to `list_items where planned_meal_id=?` inside the same table.
- If meal-derived rows grow distinct lifecycle/columns (qty text, instruction anchor), the filter tax outweighs the saving — reversible to a split table then.

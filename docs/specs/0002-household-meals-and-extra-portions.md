# Plan meals for household eaters plus extra portions

Status: Implemented (ADR 12); native acceptance pending.

## Problem

Meal planning currently stores a total `servings` number and calls it both
"servings" and "portions" in the UI. That number hides the user's intent:
who from the household is eating, and how much additional food to make.

The user should not have to translate their household into an abstract portion
count, register guests, or assign appetite values to individual guests.

## Desired behavior

A planned meal expresses:

- **Household eaters:** which household members are eating this meal.
- **Extra portions:** additional food to prepare, without assigning it to anyone
  or specifying what it will be used for.

Example: dinner for two adults and a toddler, plus 2.5 extra portions.

The household selection is concrete. The extra is deliberately anonymous: it
could feed guests, become leftovers, or simply provide more food. Fractional
extra portions are useful; individual guest identities and appetite estimates
are not required.

Default to the usual household eaters and zero extra portions. Allow the user
to change household participation for this meal and adjust the extra amount.
A slider is a possible control for the extra, not a settled UI requirement.

## Domain boundaries

- An adaptation is a recipe variant, not a separate "adapted for" entity.
  Changes to ingredients, amounts, preparation, or equipment belong in variants.
- A planned meal expresses household participation and the extra amount for
  this occasion. It should not force the household into a displayed total
  portion count.
- Recipe yield describes what the recipe makes. It is not a substitute for
  household context and need not be the primary meal-planning control.
- Extra portions do not imply a future meal or an allocation of leftovers.

## Dependency

Build household profiles first. This work needs a way to identify household
members and obtain the household context used when adapting recipe amounts.
The profile's exact structure is outside this issue.

Do not implement this as a terminology-only rename of `servings` to `portions`.
The existing total quantity and the proposed extra quantity have different
meanings.

## Acceptance criteria

- A planned meal defaults to the usual household eaters with no extra portions.
- The user can select which household members are eating that meal.
- The user can request fractional extra portions, including 2.5, without adding
  guests or explaining where the food will go.
- Household participation and extra portions persist with the planned meal.
- The UI clearly labels the quantity as extra, not as the total household amount.
- Before implementation, settle how household participation and extra portions
  affect recipe and shopping quantities. Any behavior shipped must make its
  limits clear rather than implying scaling that does not happen.
- Existing planned meals receive an explicit migration decision; their current
  total `servings` values must not silently become extra portions.

## Settled questions

- One extra portion is one adult helping of the dish. A definition, not a
  calculation the app performs.
- The baseline is everyone in the household. `meal_times` is free text, so
  the app cannot compute usual attendance; the user unticks people per meal.
- Quantities follow eaters only when the assistant writes the recipe at save
  time, sized for the eaters and extra named in the Save & plan message.
  Planning a saved recipe by hand or editing eaters later never rewrites the
  recipe or shopping items; the sheet says "Amounts follow the recipe as
  written." Resizing a saved recipe is a chat ask.
- Existing plans were reset to everyone with no extra. Their totals were
  discarded, not turned into extra portions (migration `20260918100000`).

## Out of scope

- Guest profiles or per-guest appetite values.
- Automatically equating every adult or child with a fixed portion count.
- Reserving or allocating leftovers.
- Linking one preparation to multiple meal slots.
- Building household profiles as part of this issue.

## Implementation

- `planned_meals.eater_ids` (JSON array of `household_people` ids) and
  `planned_meals.extra_portions` replace `servings`. Defaults: everyone, zero.
- `apps/mobile/src/features/meals/eaters.ts` holds the wording and parsing
  rules; `eaters-picker.tsx` is the one control, used by the plan sheet
  (`app/variant/plan.tsx`) and the per-meal editor (`app/meals/eaters.tsx`).
- The card badge and menu show "Everyone", the ticked names with "Me" for the
  caller, and "+1.5 extra" when set.
- Save & plan from a chat Sketch sends "Save this and plan it for Friday
  dinner. Eating: me and Ben, plus 1.5 extra portions." The assistant sizes
  the recipe for that and passes `eaterIds` and `extraPortions` to `planMeal`.
- `readPlan` returns eater names and extra so the assistant answers "who is
  eating Friday" from the plan.
- Recipe yield stays descriptive text on the variant.

Add explicit leftover planning only when that becomes a real task.

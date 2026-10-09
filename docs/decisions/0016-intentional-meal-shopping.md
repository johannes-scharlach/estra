# 16. Planning a meal is not a shopping decision

Date: 2026-09-24
Status: Accepted
Amended by: 23 (explicit ingredient decisions)

## Context

On a shared list, an ingredient must mean someone intends to buy it. Automatic
recipe projection mixes buying decisions with ingredients already at home.
Items for past meals also need to acknowledge their age without guessing
whether the meal was cooked or the shopping was done.

## Decision

- Planning, importing into a slot and repeating a meal create no shopping
  items. This supersedes the automatic additions in ADRs 10, 14 and 15.
- Shopping offers upcoming meals to review one at a time. A planned recipe
  also offers the same review directly, including just after planning it.
- The review separates likely purchases (initially selected) from ingredients
  probably at home (initially unselected). The recipe-writing AI supplies a
  `shopping_hint` for each ingredient in the existing variant JSON; it is a
  suggestion, not household inventory. Older ingredients without a hint default
  to likely purchases. Shopping-aisle categories do not determine this hint.
- Only explicit selections add shopping rows. Existing choices, including
  recognised swaps, are selected when the review is reopened; users can remove
  unbought items there. Bought rows remain purchase facts. Shopping entries
  remain separate per meal, with random ids as in ADR 7.
- Each planned recipe records the variant whose shopping was reviewed. This
  household-shared marker also records a completed review with nothing chosen;
  new plans and recipe-version changes start unreviewed. It is independent of
  the shopping rows, so later removal or purchase does not reopen the prompt.
- Recipe rewrites update existing chosen ingredients and remove unbought
  ingredients no longer in the recipe, but never add unchosen ingredients.
  Bought facts are preserved. This amends ADR 14's rewrite projection.
- An active shopping item whose meal date is before today shows how many
  calendar days ago it was planned. Today's meals are not past meals.
  Its details explicitly say the meal is in the past. Age never removes items.
- No pantry inventory or meal-completion tracking.

## Consequences

Mobile writes validate meal content and variant identity before saving choices,
so an open review cannot write to a replaced meal. Reopening a review rechecks
that meal's shopping rows inside the transaction. Separate offline devices can
still create duplicate rows, as the existing random-id model allows;
ingredients are not merged across meals. Moving a meal continues to carry its
shopping rows and review state, changing their date context. Existing shopping
rows are not retroactively removed.

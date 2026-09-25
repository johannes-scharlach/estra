# The recipe page tells the truth about the meal

Status: Accepted (ADR 13); implementation in tickets T8–T11.

## Problem

A planned meal is a recipe plus intent: who is eating, how much extra, and
whatever got swapped on the shopping list. Today those facts live apart and
the recipe page ignores all of them:

- The variant page always shows the recipe as written. Its "Add to plan"
  button is the only action, even when the recipe was planned a minute ago.
- Swaps made while shopping change the list item only. Cook mode still says
  sardines after you bought tuna.
- Swaps made on the variant page are local state. They vanish on back.
- Eaters and extra scale nothing for a hand-planned recipe (ADR 12). That is
  honest, but the mismatch between "Serves 4" and "for 3 + 1 extra" is shown
  nowhere.

The user can see none of this and can do nothing about it.

## How planning actually happens

Three moments with different costs. Deciding is cheap and coarse: dish names
on days, eaters known at once and rarely changed. Shopping is the first real
commitment; swaps here are facts about what is in the bag, often made by a
different household member than the cook. Cooking is the second commitment;
it is the only moment when everything is known. Nobody finalises a recipe.
An explicit "settle" step would be skipped.

Ingredient swaps happen at all three moments: while planning, while shopping,
and while getting ready to cook ("no sardines, but tuna").

## Desired behavior

The variant page, opened for a planned meal, shows the meal's facts next to
the recipe's facts and lets the user act by hand. Nothing is computed for
them before they ask.

1. **Meal strip.** "Fri dinner · Anna, Ben, me + 1 extra · Shopped" sits
   next to the recipe's own "Serves 4". No comparison is computed; both facts
   are visible and the human judges. Tapping the strip opens the existing
   eaters editor. "Shopped" appears when every list item of the meal is
   checked off; before that, "3 of 8 shopped".
2. **Ingredient rows follow the shopping list.** Each recipe line shows what
   is on the list for it: the swap if one was made, a tick if bought,
   "not on the list" if removed. Swiping a row writes the list item, the
   same write the shop page makes. An item renamed by hand, which no longer
   matches any line, is listed under the ingredients as "also on the list".
3. **The primary action is the next real one.** Planned: the floating button
   reads Cook. Not planned: Add to plan, as today. "Plan again" stays
   reachable as a text button under the strip, because planning the same
   dish twice in a week is normal.
4. **Sibling versions.** If another version of this recipe is planned, the
   page says so and links to it.
5. **Past meals.** "Last planned Tue 9 Sep" when the recipe has past meals and
   nothing upcoming.
6. **Adjust recipe.** One button on the strip asks the server to write a new
   version of the recipe: amounts for the meal's eaters and extra, the list's
   swaps folded into lines and steps, the yield text saying who it is sized
   for. The planned meal then points at the new version. The list items are
   untouched, because they are the input, not the output. The button shows a
   spinner for a few seconds and a retry on failure. Nothing runs without the
   tap (ADR 6).

When the page is opened for an unplanned variant, nothing changes from today:
row swaps stay a preview.

## Domain boundaries

- The shopping list is the record of pending swaps. There is no second store
  of swaps on the planned meal or the variant.
- A variant is still immutable content (ADR 8). Adjusting writes a new row
  under the same recipe; the old one stays browsable.
- Which meal a variant page is "about" is the planned meal id passed in by the
  card, else the nearest upcoming meal that uses this variant.
- Sizing is a fact on the variant as text (`recipe_yield`), never parsed into
  a number. Whether a variant is sized for a meal is a second fact:
  `variants.sized_for` records the eater ids and extra portions the adjust
  route wrote it for. The page compares those ids to the meal's, so it can
  say "in sync" or name the drift without reading the yield text.

## Acceptance criteria

- Opening a planned meal's recipe from the card shows the strip with the
  weekday, slot, eaters label and shopping progress; Cook is the primary
  action.
- Swapping a line on that page changes the corresponding list item, and the
  shop page shows the same swap. Swapping on the shop page shows on the
  recipe page.
- A purchased item shows as bought on the recipe line. A removed item shows
  as not on the list. A renamed item appears under "also on the list".
- With every item checked off, the strip reads "Shopped".
- Opening version 1 while version 2 is planned shows the sibling link.
- Adjust writes a new variant, repoints the meal, keeps every list item row
  with its status and name, and lands on the new version's page. A retry
  after a timeout finds the finished result instead of writing twice.
- The name-matching rule between list items and recipe lines exists once, in
  a workspace package used by both the app and the API.

## Settled questions

- An item is matched to its recipe line by name: the item name equals the
  line's ingredient or one of its listed swaps. Ambiguous or unmatched items
  are shown, not guessed. Swaps need no schema change; sizing did (one
  nullable column, `sized_for`), because there is no honest way to tell from
  "Serves 4" whether a recipe was written for this meal.
- The meal group's second row is the recipe's standing against the meal:
  "Adjusted for this meal" when in sync, otherwise the drift (the recipe's
  own yield text, and how many swaps its steps don't know about) under the
  Adjust action. For a planned meal the yield is not repeated in the hero.
- Repointing a planned meal to the adjusted variant does not reproject list
  items. `list_items.variant_id` moves with it so swaps keep resolving.
- The chat's `updateRecipe` plus `planMeal` stays as it is for unplanned
  recipes. For a planned meal the assistant should prefer the adjust route;
  teaching it that is a later prompt change.
- Model: Gemini Flash, the same family the import uses.

## Out of scope

- Parsing `recipe_yield` or computing a portion count.
- Pre-generating the adjusted recipe on the morning of the meal.
- Recording that a meal was actually cooked.
- Linking one preparation to several slots.
- Changing the chat prompt to use the adjust route.

## Implementation

- `packages/meals` (`@estra/meals`): `itemNameKey`, `lineForItem`,
  `mealDelta`. Pure functions over plain types, no zod. Both apps import it;
  the API's `plan.ts` and the app's `db/items.ts` drop their own copies of
  `itemNameKey`, and `features/shop/alternatives.ts` is built on
  `lineForItem`.
- `apps/api/src/routes/planned-meals.ts`: `POST /v1/planned-meals/:id/adjust`
  with `{ operationId }`. The new variant id is derived from caller,
  operation and planned meal id, so a retry returns the existing result.
- `apps/mobile/src/app/variant/[id].tsx` reads `plannedMealId` from its
  params, queries the meal, its items and the household, and renders the
  strip, rows and FAB from `mealDelta`. `meal-section.tsx` passes the id.
- Tickets: `tickets/08-meals-package.md`, `09-variant-knows-its-meal.md`,
  `10-rows-follow-the-list.md`, `11-adjust-recipe.md`.

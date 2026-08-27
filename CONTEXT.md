# Estra

Meal planning and shopping in one place — plan meals, derive the List, cook from variants.

## Language

### Cooking

**Recipe**:
A named dish as grandma wrote it — the title in the book (e.g. "Chicken Traybake").
_Avoid_: Dish, meal

**Variant**:
A complete, cookable version of a Recipe with its own ingredient lines and instructions. The first Variant is the original as imported; every Swap chooses or creates another Variant. The Variant is identified by its set of Swaps, so the same Swaps always give the same Variant.
_Avoid_: Version, fork

**IngredientLine**:
One row in a Variant — `qty_text` + `item_name` + optional `prep_note` (e.g. item "roasted peppers", qty "1 jar", prep "drained" — rendered as "1 jar roasted peppers, drained" in the recipe, projected as "1 jar roasted peppers" on the List).
_Avoid_: Ingredient, item

**PlannedMeal**:
A Recipe + chosen Variant placed on a calendar slot (day/meal) with servings.
_Avoid_: Meal plan entry, scheduled recipe

### Shopping

**List**:
The single checkable list for a household — groceries, meal-derived items and non-food together. Checked at home ("do I have this?") and at the shop ("did I buy this?").
_Avoid_: Shopping list, home list, groceries list, shop list

**ListItem**:
One checkable row in the List. Either `standalone` (manually added, e.g. "lemons") or `meal-derived` (projected from a PlannedMeal's Variant).
_Avoid_: Entry, product

**Swap**:
Choosing a different Variant for a PlannedMeal.
_Avoid_: Substitution, replacement

**SwapSuggestion**:
A stored 1:1 alternative for an IngredientLine (e.g. "bell pepper → jarred roasted peppers"), generated when a Recipe is imported. Not a Variant until chosen.
_Avoid_: Alternative

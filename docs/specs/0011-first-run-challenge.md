# First-run challenge

Status: shaped, signed off 2026-10-13. Builds on `0003-profile-onboarding.md`.

## Problem

Onboarding is a questionnaire. A new user answers eleven screens and reaches
the account step without having felt what Magpie does. The profile answers go
into a void: nothing shows how they change a meal or a shop.

Meal ideas generated from a near-empty profile read as generic, and a
chat-only first experience feels like "I already have this with ChatGPT".
That is also not how the app is used: a session usually starts from an
ingredient at hand or a dish in mind, and the meal gets worked out together.
Week planning feels much better once the cookbook holds the user's own
recipes.

## Solution

After sign-in, Home shows a challenge card. It gives the user goals, not a
tour: the real app is what they learn. Nothing in the app is highlighted or
overlaid; each goal's text says what to do, and the user finds the way.

Empty screens on Meals, Shop and Cookbook state a goal in plain words. They
show whenever the screen is empty, not only on first use. Planning a meal and
choosing what to buy are learned there, not in the challenge.

## Challenge goals

| Goal                         | Target | Shown as     |
| ---------------------------- | ------ | ------------ |
| Import your go-to recipes    | 5      | Progress bar |
| Cook from what's on hand     | 1      | Checkbox     |
| Cook a dish you have in mind | 1      | Checkbox     |
| Start from an idea           | 1      | Checkbox     |
| Start a chat on a recipe     | 1      | Checkbox     |

- Five imports make the cookbook feel like the user's own. The four single
  goals each try one way into a meal.
- Any import mode counts (URL today; others later).
- The three chat goals count once the chat saves a recipe. Planning from chat
  requires a saved recipe (`planMeal` in `apps/api/src/chat-tools.ts`), so a
  planned chat meal always counts.
- "Start a chat on a recipe" means a chat started from a recipe page (ADR 14).
  Any recipe page counts.

## Card lifecycle

- The card sits on Home and cannot be dismissed.
- When every goal is done, a finish moment plays once and the card is gone
  for good.
- Progress is per user. People who join a household by invitation get the
  challenge too; household recipes created by others do not count for them.

## Counting progress

Progress is derived from data the app already writes. The challenge stores
no state of its own, so resuming needs nothing extra. Only the finish moment
needs to know it was shown.

| Goal          | Counted from                                         |
| ------------- | ---------------------------------------------------- |
| Imports       | `recipes` with `origin = import`, `created_by` = me  |
| On hand       | `recipes` with `origin = on_hand`, `created_by` = me |
| Dish in mind  | `recipes` with `origin = dish`, `created_by` = me    |
| From an idea  | `recipes` with `origin = idea`, `created_by` = me    |
| Recipe chat   | `chats` with `recipe_id` set, `created_by` = me      |

### Schema

- `chats.entry`: `on_hand` | `dish` | `idea`, nullable. Set when the chat
  starts from Home's on-hand chips, the dish-in-mind entry, or an idea. Recipe
  chats leave it null; `recipe_id` already marks them.
- `recipes.origin`: `import` | `on_hand` | `dish` | `idea`, nullable. Import
  sets `import`. `addToCookbook` copies the chat's `entry`.
- Backfill: recipes with `from_url` get `origin = import`. Recipes saved from
  older chats stay null and do not count.

Follow `docs/schema-changes.md`: both columns land in the migration, the sync
config and the client schema.

## Open for implementation

- Where "the finish moment was shown" lives (per user, synced, so a second
  device does not replay it).
- Copy for each goal and each empty state.

## Not in this spec

- The profile questions before email. They stay as in 0003.
- New import modes (voice, screenshot, photo). Independent work; the import
  goal counts whatever import offers.
- A reward for finishing (e.g. 30 days of premium). Later, once premium
  exists.
- The visual redesign of the existing questions. That is the designer brief
  from the onboarding review.

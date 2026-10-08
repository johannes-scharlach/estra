# 15. Choose recipes by group; a meal can stand alone

Date: 2026-09-23
Status: Accepted

Shopping amendment: [ADR 16](0016-intentional-meal-shopping.md) makes repeating
a meal calendar-only; shopping choices are made separately for the new meal.

## Decision

- Meal selection shows the ten newest cookbook additions, ordered by recipe
  creation date. Each recipe appears once, using its latest variant. Browse
  cookbook is the last card and opens a native stack screen with search.
- Cookbook browsing also shows one row per recipe. Search finds the latest
  matching variant per recipe and labels older matches. Other variants remain
  explicitly accessible. Equal timestamps use the variant id as a stable tie-break.
- The user-facing term is variant: alternatives remain valid alongside each
  other. Latest-first is the current selection rule, not a replacement history.
- Plan again copies the exact historical variant, eaters and extra portions to
  an empty destination. New shopping items are unpurchased. History is unchanged.
- A written meal stores `planned_meals.name` with null recipe and variant ids.
  Saving is local and creates no cookbook entry or shopping items. Recipe meals
  have null `name`. Written meals can be edited, moved, repeated and removed.
- Help with shopping starts a meal-scoped chat. The server reads the meal,
  eaters and existing shopping items. Chat can add requested shopping items
  directly to that meal without inventing a cookbook recipe. Suggestions and
  clarification belong in chat, not in a new structured shopping wizard.

## Consequences

Meal context does not require recipe context. Initial chat reads remain persisted
tool results following the first user message (ADR 14). The client waits for its
local meal edits to reach the server before starting that conversation. Moving
meals carries their shopping rows, including purchased state and manual changes.
Each meal has a `content_id` distinct from its deterministic slot id. Moves carry
it; repeating or replacing a meal creates a new one. Chats record the starting
content id, so shopping writes from an old conversation reject a replaced or
swapped slot. Shopping rows use random ids; the locked meal and name lookup make
chat additions retry-safe even after earlier items have moved to another slot.

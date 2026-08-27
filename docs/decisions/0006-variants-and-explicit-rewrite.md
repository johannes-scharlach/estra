# 6. Variants and explicit recipe rewrite

Date: 2026-08-24
Status: Accepted

## Context

We discussed what should happen to the recipe when you swap an ingredient. The recipe needs changed ingredients and instructions, so we need to decide when to run Gemini Flash to rewrite them. There are two kinds of swaps: simple one-to-one and more complex where one or many ingredients become one or many others.

## Decision

Each Recipe has many Variants. The first one is the original as imported. A Variant is identified by its Recipe and its set of swaps — the same swaps on the same Recipe always give the same Variant, so we can look it up instead of generating twice (deterministic id, same idea as `list_items` ids in `supabase/migrations/20260818100000_initial_schema.sql:60`).

A Swap means choosing a different Variant for a PlannedMeal.

SwapSuggestions are generated with Gemini Flash when a Recipe is imported and stored with the Recipe. They cover the simple swaps. Complex swaps are generated on demand through a conversation.

A Variant is written only when the user asks for it. If the Variant for the chosen swaps already exists we show it straight away. If not, we tell the user "Variant with [these swaps]" and show a button to generate it. Generating takes a few seconds with Gemini Flash — the user expects that — and if it fails we show a retry button. Nothing happens in the background without the user asking.

By default a Recipe shows its latest Variant. Older Variants stay browsable and cookable — you can choose any Variant for a PlannedMeal.

LLM rewriting is long-running per ADR 5, so it lives in `apps/api` like the existing chat route.

## Consequences

- No hidden background writes. The user always knows whether a Variant exists or needs to be generated, and explicitly triggers the wait.
- Deterministic Variant ids keep us from creating duplicates when two PlannedMeals use the same swaps.
- Latest-is-default means no separate "favourite" feature. We just keep history.
- Simple swaps are available offline because their suggestions were stored at import; complex swaps need connectivity.

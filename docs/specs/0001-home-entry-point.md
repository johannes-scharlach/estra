# Spec: Home is an entry point, not a conversation

Date: 2026-09-04 (revised 2026-09-04 after review)
Amends: ADR 9 (home = "current chat", seeded deck as empty state)

## Problem Statement

The home screen presents two unrelated things at once: a header telling me
to start from two or three ingredients, and a scrollable wall of
thirty-odd idea cards with dense text. Neither matches how cooking
actually starts. I open the app with two, sometimes three things I want in
my meal ("broccoli and sausage"), want directions to flip through one at a
time, and then want to converge on one — possibly swapping what I don't
have ("no egg noodles, but rice"). That loop thrives in chat, but an empty
text box doesn't invite it — an empty composer reads as "talk to
ChatGPT", and then why am I here — and thirty cards overwhelm it. On top
of that, the chat lives on a tab screen, so the composer and the tab bar
fight each other for the bottom edge, and the persona says "the cook"
when the user is the home cook — the assistant brings chef-level skill as
a friend on the phone, but handles logistics and structures ideas; every
taste decision belongs to the user.

## Solution

Home becomes a single-purpose entry: "What's on hand?", a chip-list
input — you add two or three ingredients the way you add items to the
shopping list, then "Get ideas" starts the conversation — plus one quiet
link to the thirty weeknight ideas (they remain valuable: they prove the
five-ingredients-or-less thesis — but as a separate entry point, not the
front door). Starting pushes a full-screen conversation with no tab bar.
Ideas from the assistant render as a swipeable pager — one card at a
time, flip through alternatives — and tapping a card expands it into a
Sketch. The commit moment is a button and a native form sheet: tap
"Save & plan", pick day/meal/servings, confirm — and only then does a
single, complete user message ask the assistant to save and plan it, in
words that echo what you actually agreed to. Nothing ever puts words in
your mouth. The chat remains fully capable for iteration (swap, merge,
substitute, more ideas).

## User Stories

1. As a home cook, I want the home screen to ask me one question — what
   do I have? — so that I know exactly how to start without reading.
2. As a home cook, I want to add my two or three ingredients like items
   on a list, so that starting feels dedicated to this task, not like
   being dropped in front of a blank ChatGPT box.
3. As a home cook, I want to tap "Get ideas" and get a handful of
   directions, so that I can pick a way to take them.
4. As a home cook, I want the first chat message to restate my
   ingredients plainly ("I have broccoli and sausage"), so that nothing
   puts words in my mouth.
5. As a home cook, I want to reach past conversations from a history
   button on the home screen, so that I never have to start a new chat
   just to find an old one.
6. As a home cook, I want the entry form cleared when I come back from a
   conversation, so that home is always ready for the next meal.
7. As a home cook, I want to flip through ideas one at a time like
   cards, so that comparing alternatives feels like choosing, not
   scrolling.
8. As a home cook, I want to see which idea I'm on (2 of 4), so that I
   know I haven't missed any.
9. As a home cook, I want to tap an idea to turn it into a Sketch, so
   that I can smell the dish before committing.
10. As a home cook, I want the ideas deck to stay in the conversation
    after I pick one, so that I can scroll back and reconsider.
11. As a home cook, I want to substitute, add, or merge ingredients in
    plain chat after ideas land, so that "no egg noodles, but rice" just
    works.
12. As a home cook, I want a "Save & plan" button on the Sketch, so that
    committing feels deliberate and under my control.
13. As a home cook, I want the plan sheet to be a plain form — day,
    meal, servings — with no background work happening behind it, so
    that nothing is decided before I confirm.
14. As a home cook, I want the message sent when I confirm the form to
    say exactly what I agreed to ("Save this and plan it for Friday
    dinner, 2 servings"), so that the app never speaks for me beyond
    what I actually chose.
15. As a home cook, I want the save and the plan to complete even if I
    leave the chat or close the app afterwards, so that confirming the
    form is the whole commitment.
16. As a home cook, I want the thirty weeknight ideas behind a quiet
    link, so that I can browse them when I'm empty-handed without them
    shouting at me when I'm not.
17. As a home cook, I want tapping a seeded idea to open a conversation
    about it, so that browsing and starting are one motion.
18. As a home cook, I want the conversation to fill the screen without a
    tab bar, so that the composer and navigation never compete.
19. As a home cook, I want the assistant's advice to feel like calling a
    friend who really knows food, while I stay the cook, so that every
    taste decision remains mine.
20. As a household member, I want past conversations still reachable and
    synced, so that Tuesday's Sketch is there on Wednesday (unchanged
    from ADR 9).
21. As a home cook, I want suggested replies on assistant messages as
    today, so that the chat keeps steering me after ideas and sketch.

## Implementation Decisions

**Home: chip-list entry, shopping-list style.**

- The home tab is entry-only: the prompt ("What's on hand?"), the
  chip-list input, the quiet ideas link, and a history header button. No
  conversation rendering, no new-chat button (you're already on the new
  chat).
- The input mirrors the shopping-list add flow's shape: one field where
  you add ingredients one at a time; each addition becomes a chip; chips
  can be removed again. There is no purchase history for ingredients, so
  the field is always free-text with no suggestion rows — the similarity
  is the interaction shape (add-to-list), not the autocomplete.
- "Get ideas" is enabled with one or more chips (the prompt says two or
  three; one desperate ingredient also flies, there is no hard cap).
- The first user message is assembled plainly from the chips:
  "I have broccoli and sausage." When a photo is attached (camera stays
  available — the fridge shot is a valid way to answer "what do I
  have"), any chips append after it: "I also have rice." No adjectives,
  no invented intent — the message says what the user said and nothing
  more.
- The chat id is generated client-side (as today). On "Get ideas": the
  id and the assembled message are handed to `chats/[id]`
  (`setCurrentChat` plus a pending-message handoff), the screen pushes
  immediately, and the send/stream starts once, deduped, on the chat
  screen. Home clears its chips on push so it's fresh on return.
- If the current chat already has history (coming back from a push),
  home still shows the empty entry — past conversations live behind the
  history button.

**Conversation screen.**

- New presented route `chats/[id]` (push, no tab bar) owns the
  conversation: today's rendering, streaming, composer-with-suggestions,
  and error/“…” states move there nearly verbatim. Chat title in the
  navigation bar as today.
- Header: back button only. No history button (that's home's job), no
  new-chat button (backing out gives you a fresh entry).
- "New chat" as an action disappears entirely — home is the new chat.

**Ideas pager.**

- The `<ideas>` segment renders as a horizontal pager: one card full
  width, `pagingEnabled` snapping, pages animated in/out, a snap haptic,
  and a position indicator ("2 of 4" plus dots). The card holds the
  title and the pitch; tapping the active card sends "Tell me more
  about …" (unchanged). Cards share the tallest card's height so the
  deck doesn't jump mid-flip.
- The pager is pure rendering over the existing parsed segment; no
  message-format change. In scrolled-back history it behaves identically
  (a deck stays a deck; you can re-flip it).

**Save & plan: form first, message on confirm.**

- The `<sketch>` segment gets a footer button, "Save & plan" — the one
  deliberate action surface on the sketch page.
- Tapping pushes the existing plan formSheet (`variant/plan`) without a
  variant id. The sheet learns a pending state for this: no variant
  query, no resolving spinner, just the form — day strip, meal slot,
  servings, confirm. Nothing happens behind the sheet.
- Confirming the sheet sends one user message assembled from what was
  agreed: the dish as titled in the Sketch, and the chosen slot — e.g.
  "Save this and plan it for Friday dinner, 2 servings." Day is named
  the way the user saw it on the strip (today/tomorrow/weekday). No
  words beyond what was on screen.
- The assistant answers that message with two tool calls —
  `addToCookbook`, then `planMeal` — per the existing prompt rule
  ("both in one go, never asking them to say it twice"). Server side
  needs nothing new: the tools and the rule already exist.
- The sheet closes on confirm; the chat shows the composed message and
  the assistant's confirmation as the turn completes. Leaving or closing
  the app afterwards is safe — the server finishes the turn (ADR 9).
- The utility suggestion model's "Save it to my cookbook" chip is
  superseded by the button flow; the suggestion prompt learns to phrase
  the sketch-stage first reply as "Save & plan it" and the client does
  not render that chip (the button is the control). Simplest honest
  cut: filter that phrase client-side.

**Persona: balanced, not over-corrected.**

- The assistant keeps its chef's skill — "calling your chef-y friend
  for advice". What changes is who cooks: the user is the (home) cook;
  every decision that requires taste is theirs; the assistant handles
  logistics and structures ideas. Home cooking, not restaurant cooking.
- Prompt wording (`docs/artifacts/system-prompt.md` and the API's
  prompt copy): adjust the framing lines — "acting like a real pro home
  cook" and "You are a cooking assistant … a skilled cook" → the
  assistant is a skilled cook at your service, but you are the cook of
  this kitchen. Keep tasting guidance ("teach them to trust their
  palate") as-is; it already hands decisions to the user.
- Identifier renames ARE in scope (the code must not lie):
  `cook-prompt.ts` → `assistant-prompt.ts`, `COOK_SYSTEM_PROMPT` →
  `ASSISTANT_SYSTEM_PROMPT`, `CookUIMessage` → `AssistantUIMessage`
  (both copies: API route + mobile stream module). `variant/cook` (cook
  mode) stays — that's cooking, done by the user.
- Comment sweep: "the cook writes"/"the cook's system prompt" → the
  assistant.

**Tests.**

- Introduce a minimal test seam where parsing lives: unit tests for the
  tag/segment parser (complete, unclosed mid-stream, stray/broken tags,
  empty ideas) and for the first-message and save-and-plan message
  assemblers (the wording the user agreed to). Vitest, co-located in the
  mobile app. This adds vitest to the workspace and a `pnpm --filter
mobile test` script — root AGENTS.md ("there is no test suite") and
  the verify command list get a one-line update.

**ADR.**

- ADR 9 gets an amendment section matching all of the above.

## Testing Decisions

- New seam: **message assembly and tag parsing**, unit-tested with
  Vitest in the mobile app. These are pure functions over strings and
  parts — the exact place where "putting words in the user's mouth"
  would regress.
- Good tests assert external behavior (message text out, segments out),
  never component internals.
- Everything else: `pnpm typecheck`, `pnpm lint`, and a manual device
  pass per ticket with the seeded dev login — ingredients in, flip
  ideas, tap one, Sketch, Save & plan, confirm the form, message echoes
  the choices, recipe and plan land.
- Prior art: none in-repo; this spec introduces the test suite
  (documented in AGENTS.md when it lands).

## Out of Scope

- Injecting controlled randomness into idea generation (explicitly
  deferred).
- Renaming the `variant/cook` route (cook mode is the user's own mode;
  it stays).
- Editable recipe title at save time.
- Ingredient autocomplete/history on the entry field (no purchase
  history to mine; free text only).
- Any inventory or pantry tracking.
- Changing the seeded ideas' content or count.
- Removing the photo path from the entry (camera remains; chips alone
  are the common case).

## Further Notes

- Native feel: pager snapping has a selection haptic per page; sheets
  stay native pageSheet/formSheet routes; the entry screen does not
  auto-focus the field.
- The prompt's exploration skill already produces 2–4 ideas; the pager
  works with any count.
- The "same message, no invented words" rule applies everywhere the app
  speaks for the user: entry message, save-and-plan confirm, seeded-idea
  picks ("Let's do {title} with {ingredients}." is already factual —
  keep it).

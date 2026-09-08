# 9. Chats live in the database, the server writes them

Date: 2026-09-02
Status: Accepted; amended 2026-09-04
Amends: 5 (the "server stores nothing" chat contract)

## Context

The Home screen is a conversation with a cook, not a recipe list. You start
from two or three things you have, or from a seeded idea, and build one
evening's cooking bit by bit: exploration (2–4 directions), a Sketch (one
direction made real, no quantities), and a save (the full recipe, written
only when asked). The system prompt for this exists and works; the model
writes Markdown and calls tools only to act (save, update, look up, plan),
never to present content.

That workflow needs history. A Sketch started on Tuesday gets picked up on
Wednesday, possibly by the other person in the household. ADR 5's contract —
the client sends the whole `UIMessage[]` every time, the server keeps
nothing — cannot give us that: history would live on one phone, and the
request would grow with every turn.

`apps/api` already writes Postgres directly for recipe import
(`apps/api/src/routes/recipes.ts`, ADR 8). PowerSync carries the rows back
to devices. The same shape fits chat.

## Decision

Two tables, scoped by list so the household shares them (ADR 4):

* `chats`: `id, list_id, created_by, title, created_at, updated_at`.
  `title` is the first user message, trimmed. `created_by` is attribution,
  not access.
* `chat_messages`: `id, chat_id, role, parts, created_at`. `parts` is the
  AI SDK `UIMessage.parts` array as jsonb, stored as is, so text, tool calls
  and tool results round-trip without a schema of our own.

Access is list membership, same as everything else. RLS via
`is_list_member`, sync streams keyed by membership.

**The server is the only writer.** `POST /v1/chats/:id/messages` takes the
newest user message only. The server checks the caller is a member of the
chat's list, inserts the user message, loads the chat's history from
Postgres, streams the reply, and inserts the assistant message when the
stream finishes. The persisted assistant row has the same id the stream
used.

**Clients render from the database.** The chat screen queries
`chat_messages` through PowerSync. The one exception is the reply in
flight: it comes from the stream while streaming, and is dropped as soon as
a row with its id has synced.

**Content stays Markdown, marked with three tags.** The model writes
Markdown and wraps the two blocks the app reacts to:

* `<ideas>` holds several `<idea title="…">` blocks. Rendered tappable;
  tapping one sends "Tell me more about …" as the user's message. Cards
  are right here because an idea has an action. (Their layout was first
  a vertical stack; the amendment below flips them to a pager.)
* `<sketch title="…">` is one direction made real, still without
  quantities. Rendered as a page, not a card: no container, no border,
  just typographic treatment — title set large, prose at a comfortable
  measure. The writing has to carry the taste of the dish, and a box
  around it says "component". Nothing on the Sketch is tappable.

**Actions live in the composer, never in the content.** After each reply
a cheap utility model proposes two to four suggested replies in the user's
voice ("Tell me more about …", "Save it to my cookbook", a likely tweak).
They travel as a data part appended to the assistant message before
`finish`, so they persist with it and show above the keyboard whenever
that message is the latest. Tapping one sends that message, and the model
acts through its tool because the user asked. One rule for the whole
screen: everything the user does is a message.

Once a Sketch exists, the chat takes its title, in the navigation bar and
in the history list.

Only the title is an attribute. Everything between the tags is ordinary
Markdown, so explorations do not all have to look alike. No structured
output or tool call is asked for during exploration or sketching, because
that measurably worsens the writing; a wrapping tag, tested in the
prototype, does not.

Rendering splits the message on these tags before the Markdown pass: text
segments render as Markdown, tagged segments with their own treatment and their inner
Markdown. An unclosed tag mid-stream renders as far as it has arrived, filling as tokens
arrive. Unknown or broken tags are stripped, so the worst case is plain
text, never raw angle brackets.

## Consequences

* ADR 5's "the server stores nothing" no longer holds for chat. The route
  in `apps/api/src/routes/chat.ts` changes shape; the UI message stream
  protocol on the wire stays.
* The direct Postgres pool bypasses RLS. The route must check list
  membership before reading or writing a chat. This is the same obligation
  the recipe import already carries, made explicit here.
* Photos cannot go into `parts` as base64. They go to a private Storage
  bucket under the list's id, and the part holds a signed URL (30 days)
  that every member's phone can show and the server fetches for Gemini.
  Older photos in a chat go blank after that; acceptable for a weeknight
  conversation.
* Planning from the chat writes `planned_meals` and projects the shopping
  items server-side, a twin of the client's `db/planned-meals.ts`. Same
  deterministic ids, same projection; the two must change together.
* History sent to the model is capped (last ~30 messages). A chat that ran
  for a week must not cost a week of tokens per turn.
* Nothing to send offline. Generating needs the network anyway, so the
  client does not queue user messages locally. Reading history works
  offline because it is synced.
* The server finishes a reply even when the phone drops the connection
  (backgrounded mid-stream). It is persisted either way and waiting on
  return, and a tool call is never left half done. The cost is tokens for
  a reply nobody may read; the alternative was losing it.
* `chat_messages` grows without bound. The stream is per list; if it ever
  hurts, scope it to recent chats first.
* Home becomes "current chat", with a way into past chats and a "new chat"
  action. ~~A fresh chat's empty state is a seeded deck of ideas~~
  (superseded — see the amendment below). They are inspiration, not
  cookbook entries; the cookbook only holds what was actually saved.
* Tools write to existing tables: save creates a `recipes` + `variants`
  pair (ADR 8); planning writes `planned_meals`, from which shopping items
  derive. No new entity for a "sketch" — a saved recipe is a variant with
  ingredient lines and instructions, like any import.

## Amendment, 2026-09-04 — home is an entry point

The consequences above stood up in code for two days, then met the hand.
Where the practice disagreed, the practice won:

* **Home is an entry point, not the current chat.** The home tab asks one
  question — "What's on hand?" — with an ingredient input shaped like
  adding items to the shopping list (chips, one field, a camera for the
  fridge shot) and a "Get ideas" button. An empty composer read as "talk
  to ChatGPT"; a dedicated form reads as Estra. The conversation lives on
  a pushed `chats/[id]` screen with no tab bar, so the composer and the
  tabs never share an edge again.
* **History lives on home; "new chat" is gone as an action.** Home's
  header has the history button (a sheet that pushes the chosen chat);
  the chat screen offers back only. Back returns to a cleared entry —
  home IS the new chat.
* **Push first, send once.** The chat id was already client-chosen; now
  the push happens immediately and the assembled first message is sent
  once, deduped by id, on the chat screen while the UI settles.
* **The app never puts words in the user's mouth.** Every message it
  sends in the user's name is assembled plainly from what was entered:
  "I have broccoli and sausage." from chips, "Save this and plan it for
  Friday dinner, 2 servings." from the plan form. Assembly lives in pure
  functions (`features/chat/compose.ts`) as the tested seam.
* **The seeded deck is not the empty state.** The thirty-odd ideas prove
  the five-ingredients thesis; they moved behind one quiet link on home
  (`chats/ideas` pageSheet) as their own entry point. Bundled JSON,
  inspiration not cookbook — that part stands.
* **Ideas flip, they don't stack.** `<ideas>` renders as a horizontal
  pager, one card at a time, "2 of 4" below — choosing between
  directions is flipping, not scrolling. The deck stays put in the
  transcript after a pick.
* **Commit is a form, not a sentence.** The Sketch gained the one
  deliberate action surface: "Save & plan" opens the existing plan
  formSheet (day, meal, servings) with nothing running behind it.
  Confirming sends the single complete message above; the existing
  "both in one go" rule makes the assistant call `addToCookbook` then
  `planMeal`. The server changes by one word (the suggestion prompt's
  sketch-stage reply now says "Save & plan it").
* **Persona, balanced.** The user is the home cook; every decision that
  requires taste is theirs. The assistant keeps its chef-level skill —
  the friend on the phone — and owns logistics and structure. (Naming
  the code accordingly is tracked separately.)

What does NOT change: the server is the only writer, clients render from
the database with the in-flight exception, content stays Markdown in
tags, actions stay out of content (the sheet's confirm IS the message),
photos stay in Storage.

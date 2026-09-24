# 14. Start recipe chats on the variant, continue in chat

Date: 2026-09-22
Status: Accepted

Shopping amendment: [ADR 16](0016-intentional-meal-shopping.md) removes automatic
additions on planning and rewriting. Previously chosen items still update.

## Decision

- The variant page has a composer beside a compact Cook / Plan action.
  Sending creates a new conversation and pushes the chat screen. Reading a
  variant reached from chat follows the same new-conversation rule.
- Recipe conversations belong to the recipe and household. More offers
  Chat history and Variants. General history excludes recipe conversations.
- The first user message initiates a persisted synthetic `readVariant` tool
  result containing the actual starting variant. This ordering follows the
  model protocol: user turn, function call, function response. A selected
  meal is also read, including eaters and shopping items. Subsequent
  reads and writes are ordinary tool results, never replacements of history.
- The agent can search variants, returning matching excerpts, creation time,
  yield and recorded sizing, then read a complete variant by id.
- Chat links prominently to its latest successfully written variant, falling
  back to its starting variant. Opening it pushes that exact version. Back
  keeps its normal meaning; an older version identifies when its meal has
  moved to another version.
- Adjust sends a factual message describing the selected meal, eaters and
  swaps into a new recipe chat.
- An explicit recipe rewrite in a conversation about an upcoming meal also
  updates that meal, provided it still belongs to the recipe. Past meals
  are not repointed. A normal question does not request a rewrite.
- For this first version, rewriting a meal replaces its unbought shopping
  items with the new ingredients. Exact-name matches retain their rows;
  purchased rows survive. A purchased ingredient does not become a purchased
  replacement. The tool returns an exact shopping receipt for the chat.

## Consequences

The existing automatic ingredient projection on initial planning continues.
Broader shopping behaviour needs its own framing and shaping. Pantry
inventory and ingredient-selection workflows are outside this change.

Chat scope adds recipe, starting variant and optional planned meal references
to the existing chats table. Messages still use AI SDK parts and the server
remains their only writer (ADR 9).

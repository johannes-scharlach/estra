# 26. A chat reply pushes only when nobody was waiting

Date: 2026-10-12
Status: Accepted
Amends: 19, 25 (a delivery can be about a chat reply)

## Context

A reply can take a while. The server finishes and saves it even after the
app went away, but nobody learns that it is ready. A timer would only guess
whether the user left. The server knows: the reply's HTTP stream is still
open or it is not.

## Decision

- The app holds a reply stream only while that chat is on screen and the app
  is in the foreground. Leaving the chat or backgrounding the app aborts it;
  PowerSync and the turn check catch up on return. A dropped connection in
  the supermarket counts the same.
- When the turn ends (completed or failed), the API checks whether the
  request was aborted before the final turn state was written. If so it calls
  `queue_chat_reply(message_id, user_id)`: one delivery per active device of
  the user who sent the turn, then an immediate dispatch request. The app
  aborting after PowerSync shows the end comes too late to count.
- `notification_deliveries` points at exactly one of an activity (with its
  recipient), a `reminder_date`, or a `chat_message_id`. A unique index on
  `(device_id, chat_message_id)` queues each reply once.
- The claim returns the chat id, its title and the reply's text and turn
  parts, read at send time. The worker writes the text.
- The phone shows the push everywhere except on that chat's screen.

## Consequences

A quick app switch loses word-by-word streaming for the rest of that reply,
and a push follows that the open chat hides. No seen state: a reply push is
not cancelled by opening the chat elsewhere first.

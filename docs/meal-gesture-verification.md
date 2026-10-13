# Meal gestures

Verify on a real Android device. Native gesture ownership and press cancellation
are not covered by Vitest. Device verification is pending.

In Meals, open a meal slot with enough choices to scroll horizontally:

- Swipe left and right over card images, names, and gaps. Try slow drags, quick
  flicks, and short swipes. Only the recipe carousel moves; the day stays selected
  and no meal is selected or opened.
- Repeat at both ends of the carousel, including over Browse cookbook. A swipe
  must not change days or trigger a card, even when the carousel cannot move.
- Start a horizontal drag on a card, move outside the carousel, then release.
  It must not turn into a day swipe or a card press.
- Scroll vertically starting over a choice. The page still scrolls normally.
- Tap a choice deliberately. It still plans that meal. Long press a choice;
  its variants still open. Tap Browse cookbook; the cookbook still opens.
- Swipe horizontally outside the carousel. Day navigation still works.
- Swipe over a planned meal. It changes days without opening that meal; a
  deliberate tap still opens it.

Repeat the swipe checks several times to catch the intermittent failure.
Check iOS too when a device is available.

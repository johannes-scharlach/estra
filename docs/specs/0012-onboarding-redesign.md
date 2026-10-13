# Onboarding: useful choices, native controls

Implemented 2026-10-13. This supersedes the presentation, restriction entry,
shopping entry, staple options/defaults, and portion model in spec 0003.
The separate hands-on first-run experience in spec 0011 remains out of scope.

## Experience

Use plain questions and concrete choices. Preserve the warm light palette and
clay artwork style. Large artwork belongs on welcome; equipment and ingredient
artwork belongs inside the choices. No decorative banners above busy questions,
generated response paragraphs, sparkles, or written summary at signup.

The flow retains name, goals, diet, household, avoidances, shops, equipment,
pantry, fresh, email, and code. Household add/edit remains a native form sheet on
iOS, with editable creator details and a scrollable keyboard-aware layout.

- Goals: illustrated multi-select tiles and custom entries.
- Diet: compact single-select tiles; explain only the selected diet.
- Household: names, ages, diets, portion references, attendance, and normal meals.
- Avoidances: separate allergies/must-avoids from dislikes on one screen.
  Common shortcuts and a native editor record ingredient, reason, and optional
  detail (including who it applies to). Continue always reads Continue; the empty
  state explicitly says it is fine to continue with nothing to avoid.
- Shops: actual main shop name, additional named shops with Easy to get to,
  Small detour, or Special trip. No compulsory retailer-type classification.
- Equipment: illustrated two-column grid. Oven/stove start selected and can be
  deselected. Custom equipment remains possible.
- Pantry: concrete items the household nearly always keeps.
- Fresh: concrete foods bought regularly, describing rotation and household
  habits rather than simultaneous stock. Greek and plain yoghurt are separate.
- Both staple screens: six initial suggestions, More ingredients, and custom
  items. Nothing preselected, no minimum required. Selected extra items stay
  visible when revisiting the screen. Existing category answers remain available
  under Earlier selections and can be removed; they never become specific foods.
- Email: a small composition of the user's selected ingredient/equipment artwork.
  Six-digit email verification, returning-account handling, local drafts, and
  retry-safe finalization remain. No account request before explicit email submit.
  No artificial delay after verification; local persistence gates completion.

Artwork placeholders show exact human-readable IDs. The complete production
prompts and framing requirements are in
`apps/mobile/src/features/onboarding/art/README.md`. Images are supplied later.
Native navigation/selection symbols are not artwork requests.

## Persisted meaning

- `household_people.portion_reference`: 0.25–4 regular adult portions in quarter
  steps, default 1. The creator and other people use the same editor. Recipe
  generation sums the selected people's references, then adds per-meal extra
  portions. Do not reduce an explicit reference again based on age.
- `household_profiles.ingredient_avoidances`: JSON array of
  `{ ingredient, kind: allergy | restriction | dislike, detail }`.
- `household_profiles.shops`: JSON array of
  `{ name, access: easy | detour | trip }`.
- Existing `restrictions` and `other_shops` strings remain readable/editable
  notes. No attempt to guess or parse their meaning into the new structured
  choices. The assistant receives both.
- Pantry/fresh keep their existing JSON selection shape. New item keys and old
  category keys are distinct except eggs, which was already an exact ingredient.
  Missing keys remain unselected; custom strings remain supported.
- The assistant receives usual pantry items, regular fresh purchases, and legacy
  categories separately. All are habits, not confirmed inventory.
- Shops guide sourcing, without claims about live stock. Special-trip ingredients
  should be optional, with main-shop alternatives.
- Section saves must only write supplied fields. Schema defaults must not reset
  another section during an edit.

Changing a person's reference affects subsequent recipe generation/adjustments;
it does not rewrite existing recipes or reinterpret extra portions. Existing
`sized_for` metadata still records eater IDs and extra portions, not historical
appetite snapshots (same boundary as existing diet/age edits).

## Native behaviour and verification

Continue remains enabled for missing answers. On tap, show an inline error and
focus the relevant input. This includes custom diet, person name, custom
ingredients/equipment/goals, shop name, email, and incomplete verification codes.
Disable duplicate in-flight requests, not incomplete answers.

Inputs share white/card surfaces, warm borders and visible focus/error states.
The buttons float over the same translucent scroll-edge fade as the recipe
screen; there is no footer bar or glass panel. Only the controls themselves use
Liquid Glass. Both controls move in one keyboard-following container, with 8pt
below them when the keyboard is open. Their native hosts ignore keyboard safe
areas so only the shared container adjusts their position. Keyboard-aware
scrolling clears focused inputs above the controls. Large text reflows choices and navigation.
Selection never advances automatically; native paging and reduced motion remain.

Automated checks cover draft compatibility, durable finalization of structured
choices, profile-context meanings, section-edit isolation, and portion sizing.
Native acceptance is still required for:

1. Every question, including empty/selected/custom and back/resume states.
2. Person sheet with keyboard, custom diet, portion slider and own-person edits.
3. Avoidance/shop/custom-entry sheets: save, cancel, dismiss and removal.
4. Small-screen and large-text scrolling; keyboard-following controls on both OSes.
5. VoiceOver/TalkBack labels, selected states, slider quarter-step adjustments.
6. Full code paste/autofill, incomplete-code feedback, wrong code and resend.
7. Final save against the migrated backend and PowerSync upload.

## Rollout

Migration: `20261013160000_onboarding_choices.sql`. Apply through the user's
normal stack workflow, refresh sync configuration, and regenerate DB types.
The migration, client mirror, upload decoding, and type mirror are included.
Sync streams select `household_profiles.*` and `household_people.*`, including
the added columns. Implementation does not apply migrations or restart services.

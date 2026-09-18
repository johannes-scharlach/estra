# Estra design brief

## Register

Product. The interface is the instrument: a household tool opened in the
shop aisle and at the stove. No marketing surfaces exist or are planned.

## Platform

Expo (React Native) via expo-router. iOS first-class, Android supported.
`userInterfaceStyle: "automatic"` — light and dark are both first-class,
every screen works in both.

## Users and context

Household members who plan meals and shop together. Three physical
contexts dominate:

- **At home** — checking the List against the pantry ("do I have this?")
- **In the shop** — one hand on the cart, checking items off, thumb zone
  matters, glare and distraction are real
- **In the kitchen** — cook mode: hands wet or dirty, phone at arm's
  length, glanceable single steps, screen stays awake

Offline-first is the product's core promise. Local data must never show a
spinner; optimistic UI is the established pattern (see `pending` state in
`meals.tsx`).

## Product purpose

Meal planning and shopping in one place: plan meals, derive the List,
cook from variants. Domain vocabulary is fixed in `CONTEXT.md` — Recipe,
Variant, IngredientLine, PlannedMeal, List, ListItem, Swap, SwapSuggestion.
Use these words in the UI, never the avoided synonyms.

## Voice

Neutral-leaning with some character. Vibe references: KptnCook and NYT
Cooking — confident, appetizing, uncluttered. Not wellness-app calm
(Headspace), not grandma kitsch. The app is heavily AI-driven; neutrality
is what lets the AI read as capable rather than gimmicky.

Copy rules: terse, sentence case, good button text. Empty states say what
belongs here and how to fill it.
The terse-communication rule in root `AGENTS.md` is for the dev workflow,
not product copy — but the instincts rhyme.

## Anti-references

Refuse on sight:

- Generic SaaS (purple-blue gradients, Inter-by-reflex branding, centered
  hero + card grid + pill reflexes)
- Cutesy food app (kawaii illustrations, mascots, recipe-blog energy)
- Clinical enterprise (dense admin tables, joyless grays)
- Dev-tool brutalism (terminal mono everywhere, harsh borders, raw edges)

## Composition lanes

### iOS: controls and content

Every screen separates two layers by their role:

- **UI layer:** navigation and persistent actions, including actions on
  content. Tab bars, top toolbars, Back, and persistent screen actions sit
  above the content and remain accessible as it scrolls.
- **Content layer:** what people came to see and work with — shopping
  items, meals, recipes, imagery, and cooking instructions. This is the
  primary scrolling area and the canvas for brand identity. Item-specific
  actions can sit alongside their content and scroll away with it.

Use one vertical scrolling content area per screen. Do not put independently
vertically scrolling regions inside it. Horizontal collections, carousels,
and swipe paging within vertically scrolling content are allowed. Preserve
the established paged cook-mode flow.

Liquid Glass belongs to floating controls in the UI layer. Decorative use
on content surfaces requires explicit user approval. Express identity through
content layout, color, imagery, video where useful, and a few meaningful
words. Use system fonts and SF Symbols for new iOS design; custom fonts or
icons require explicit user approval.

Work within the approved visual direction and screen patterns. Introducing
a new visual convention requires user approval. Ordinary screens, settings,
loading states, empty states, and errors share the same typography, spacing,
color meanings, and voice. These rules are iOS-focused; do not assume iOS
controls or appearance should be copied to Android.

### Screen patterns

Each screen has one dominant work pattern:

- **Shop — Operate.** The checkable List. Large targets, fast check-off,
  one-handed reach.
- **Meals — Decide/Configure.** Day strip + slot sections (lunch, dinner,
  treat). Collapsing large-title header is established.
- **Cookbook — Explore.** Browsable variants, search and scan.
- **Cook mode — Learn/Operate.** One step per screen, snap-paged, huge
  readable type, page dots, haptic on turn.
- **Home — Monitor.** Today at a glance (screen is currently a stub).

The domain artifact is the recipe and the list row. Cards only where
content is genuinely card-shaped; the app idiom is the grouped list
(iOS-style rounded-2xl sections with hairline separators), not the card
grid.

## Component choice and approval

Use this order; do not skip a tier for aesthetic preference:

1. Follow the [expo-native-ui skill](../../.agents/skills/expo-native-ui/SKILL.md)
   wherever possible. As it directs, check the
   [expo-ui skill](../../.agents/skills/expo-ui/SKILL.md) for native components
   and use the [expo-router skill](../../.agents/skills/expo-router/SKILL.md)
   for navigation.
2. When the native approach cannot meet the need, use React Native Reusables
   as the default fallback. State the concrete limitation that requires it.
   An available native control must not be replaced just to restyle it.
3. If neither can meet the need, propose a custom component. Explain both
   limitations and the proposed behavior; obtain explicit user approval
   before implementing it. The user judges whether the reason is sufficient.

Existing choices are presumed user-approved and should generally be kept.
Implementation history does not override these rules for new work. When in
doubt — especially when reworking an area with an existing implementation
that conflicts with this guidance — ask the user whether to retain it or
replace it with platform defaults. Do not silently migrate it or treat it
as permission to repeat the exception elsewhere. Approval already given in
the current work need not be requested again.

## Implementation reference (as built)

These notes describe existing choices, not requirements that override the
component order or design rules above.

- **Styling:** uniwind (Tailwind CSS v4 for RN — not NativeWind) +
  react-native-reusables (shadcn/ui, new-york style, neutral base),
  vendored in `apps/mobile/src/components/ui/`. Keep this styling approach
  for the RNR fallback and existing content; it does not constrain native
  components, which follow the relevant Expo skill's styling API.
- **Tokens:** `apps/mobile/src/global.css`, `@layer theme`, oklch values,
  light + dark via `@variant`. This is the one place to restyle. After
  editing, regenerate `src/uniwind-types.d.ts` (command in
  `apps/mobile/AGENTS.md`).
- **Color:** current palette is defined in `apps/mobile/src/global.css`;
  read it before making color choices. See Color direction.
- **Radius:** 10px base (`--radius`), sm/md/lg/xl derived.
- **Type:** `--font-display` = Spline Sans → Inter → system. Rounded
  stack (SF Pro Rounded) and mono/serif stacks defined. Text variants via
  cva in `src/components/ui/text.tsx` (h1–h4, lead, large, small, muted…).
  Screen titles: `text-4xl font-bold tracking-tight` collapsing to a
  small nav title on scroll.
- **Icons:** existing `expo-symbols` (`SymbolView`) with ios/android name
  maps — SF Symbols on iOS, Material Symbols on Android — and a Lucide
  fallback. This records the existing implementation, not an exception
  allowing new non-system icons without approval.
- **Tonal identity:** `tonalPair(id, dark)` in
  `src/features/variants/tonal.ts` — deterministic hue per recipe, quiet
  analogous two-stop gradient (pastel wash in light, deep muted in dark).
  Shared by recipe hero and cook mode so a recipe keeps one identity.
  This is the app's signature color moment; do not compete with it.
- **Native idioms:** iOS-style grouped action sheets (rounded-2xl card
  group + separated Cancel), `hitSlop={12}` on icon buttons, safe-area
  insets handled manually, haptics on meaningful transitions,
  keep-awake in cook mode.

## Color direction

`apps/mobile/src/global.css` is the source of truth for the current palette,
including light and dark semantic tokens and chart colors. Do not maintain
a competing palette specification here. Recipe tonal gradients are defined
separately in `src/features/variants/tonal.ts`.

Use color intentionally for hierarchy, actions, selection, and status. Put
large brand-color surfaces in scrolling content rather than solid navigation
bars. Preserve native semantic styling for platform controls according to
the Expo skills; do not force CSS tokens onto every native surface. Palette
changes require user approval. Verify foreground/background contrast when
changing tokens or their use; do not assume every pairing is accessible.

## Motion

Subtle and physical. Follow the
[expo-animation skill](../../.agents/skills/expo-animation/SKILL.md) for
motion decisions and implementation. Motion serves feedback, continuity,
or attention. Haptics mark meaningful state changes (cook-mode page turn).
Nothing bounces. Respect reduced motion. New gesture or interaction patterns
require user approval; familiar horizontal swiping and paging are allowed.

## Accessibility expectations

- Minimum 44×44pt touch targets; visual element may be smaller, hit area
  may not (use hitSlop / expanded pressables).
- Cook mode must be readable at arm's length in a bright kitchen — large
  type, strong contrast on the tonal gradient in both schemes.
- Never color alone for state (checked vs unchecked needs shape/icon too).
- Support iOS Dynamic Type, including accessibility sizes; allow wrapping
  and layout adaptation, with no fixed-height text containers.
- Light-on-dark and dark-on-pastel tonal surfaces need verified contrast
  per generated hue, not just the neutral palette.

## Principles

1. **Offline truth.** Local data renders instantly; sync is invisible.
   Optimistic updates with rollback are the house pattern.
2. **Thumbs and flour.** Design for one-handed shop use and no-touch
   kitchen glancing before desktop comfort.
3. **Native first.** Follow the Expo skills, then RNR when native cannot
   meet the need, then custom components only with user approval.
4. **One voice, intentional color.** Follow the CSS palette and approved
   visual direction consistently, with brand expression in the content layer.
5. **Domain words only.** Recipe, Variant, List, Swap — the vocabulary in
   `CONTEXT.md` is the UI copy vocabulary.

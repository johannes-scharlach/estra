# Estra design brief

## Register

Product. The interface is the instrument: a household tool opened in the
shop aisle and at the stove. No marketing surfaces exist or are planned.

## Platform

Expo (React Native) via expo-router. iOS first-class, Android and
react-native-web supported. Portrait only. `userInterfaceStyle: "automatic"`
— light and dark are both first-class, every screen works in both.

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

Copy rules: terse, sentence case, one verb per button ("Import & plan",
"Skip this meal"). Empty states say what belongs here and how to fill it.
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

## Visual foundation (as built)

- **Styling:** uniwind (Tailwind CSS v4 for RN — not NativeWind) +
  react-native-reusables (shadcn/ui, new-york style, neutral base),
  vendored in `apps/mobile/src/components/ui/`. New UI uses rnr
  components + Tailwind classes, never `StyleSheet`. `src/components/
  themed-*.tsx` is legacy, do not extend.
- **Tokens:** `apps/mobile/src/global.css`, `@layer theme`, oklch values,
  light + dark via `@variant`. This is the one place to restyle. After
  editing, regenerate `src/uniwind-types.d.ts` (command in
  `apps/mobile/AGENTS.md`).
- **Color:** tinted-whisper system (saffron accent, warm-tinted neutrals,
  both schemes) — see Color direction. Only other saturated colors:
  `--color-destructive` and the per-recipe tonal gradients.
- **Radius:** 10px base (`--radius`), sm/md/lg/xl derived.
- **Type:** `--font-display` = Spline Sans → Inter → system. Rounded
  stack (SF Pro Rounded) and mono/serif stacks defined. Text variants via
  cva in `src/components/ui/text.tsx` (h1–h4, lead, large, small, muted…).
  Screen titles: `text-4xl font-bold tracking-tight` collapsing to a
  small nav title on scroll.
- **Icons:** `expo-symbols` (`SymbolView`) with ios/android/web name
  maps — SF Symbols on iOS, Material Symbols on Android. lucide only when
  no native symbol fits.
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

Tinted whisper, applied. Brand hue is **saffron (oklch H 80)** — appetizing
and editorial (the KptnCook/NYT Cooking lane), 50°+ clear of destructive
red (H 27), and warm-tinted neutrals (H 75–85, chroma ≤ 0.015) harmonize
with any per-recipe tonal gradient hue. The accent is expressed through
`primary` (saffron fill, dark warm text — never white text on saffron) and
`ring` (focus). Per-recipe tonal gradients remain the only strong color
moments — the accent must never fight them. Destructive stays the existing
oklch red. All foreground/background pairs verified ≥ WCAG AA (script
checks run on every token change).

## Motion

Subtle and physical. `tw-animate-css` is available. Entrances are short
and decelerated; exits faster than entrances. Haptics mark meaningful
state changes (cook-mode page turn). Nothing bounces. Respect reduced
motion.

## Accessibility expectations

- Minimum 44×44pt touch targets; visual element may be smaller, hit area
  may not (use hitSlop / expanded pressables).
- Cook mode must be readable at arm's length in a bright kitchen — large
  type, strong contrast on the tonal gradient in both schemes.
- Never color alone for state (checked vs unchecked needs shape/icon too).
- Survive 200% text zoom; no fixed-height text containers.
- Light-on-dark and dark-on-pastel tonal surfaces need verified contrast
  per generated hue, not just the neutral palette.

## Principles

1. **Offline truth.** Local data renders instantly; sync is invisible.
   Optimistic updates with rollback are the house pattern.
2. **Thumbs and flour.** Design for one-handed shop use and no-touch
   kitchen glancing before desktop comfort.
3. **Native first.** Platform idioms (SF Symbols, action sheets, large
   titles) over custom invention. Closest-to-default option wins unless
   this brief says otherwise.
4. **One voice, rare color.** Neutral surface does the work; the single
   accent and the recipe tonal gradients are the only color events.
5. **Domain words only.** Recipe, Variant, List, Swap — the vocabulary in
   `CONTEXT.md` is the UI copy vocabulary.

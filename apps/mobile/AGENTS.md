# Mobile app

Expo Router + PowerSync + op-sqlite. Repo-wide rules in root `AGENTS.md`.

## UI stack

Standard-choice rule: pick the closest-to-default option, no custom design
direction (yet). That gives:

- **uniwind** — Tailwind CSS v4 for React Native. Not NativeWind (still v3).
  Same `className` API. Runs on iOS, Android, and react-native-web.
- **react-native-reusables (rnr)** — shadcn/ui for RN. Vendored components in
  `src/components/ui/`, built on rn-primitives. Default neutral shadcn theme,
  no styling opinions.
- **@expo/ui** — real SwiftUI widgets. Apple-only sprinkle (a native switch,
  glass effect), not the base layer.

## How it fits together

- `src/global.css` is the CSS entry (`@import 'tailwindcss'`, `uniwind`,
  `tw-animate-css`). Location matters: Tailwind scans for classes starting at
  the directory this file lives in.
- Theme tokens (oklch, `--color-primary` etc., light + dark via `@variant`)
  live in `src/global.css` in `@layer theme`. From the rnr
  `minimal-uniwind` template. This is the one place to restyle later.
- `metro.config.js` — `withUniwindConfig` must be the **outermost** wrapper.
- `src/uniwind-types.d.ts` — generated. After changing theme/tokens run:
  `pnpm --filter mobile exec uniwind generate-artifacts --css ./src/global.css --dts ./src/uniwind-types.d.ts`
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge).
- `components.json` — rnr CLI config (pre-created so `add` runs non-interactive).

## Adding a component

```bash
npx @react-native-reusables/cli add <component> --styling-library uniwind -y
```

Then install any missing deps with `pnpm --filter mobile add ...` — the CLI
calls `npx expo install` (npm) which is wrong for this pnpm workspace.

## Conventions

- New UI uses rnr components + Tailwind classes, not `StyleSheet`.
- `src/components/themed-*.tsx` are pre-uniwind legacy; don't extend them.
- **Icons:** prefer `expo-symbols` (`SymbolView`) with iOS/Android/web name
  mappings — it renders SF Symbols on iOS and Material Symbols on Android.
  Use `lucide-react-native` only when there is no suitable native symbol or
  for web parity.
- Run `pnpm --filter mobile lint` after adding components (new vendored files
  sometimes trip import-order rules).

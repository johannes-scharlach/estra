/**
 * Deterministic tonal identity per recipe: hash the variant id to a hue, then
 * build a quiet two-stop analogous pair. Light mode gets a pastel wash (dark
 * text reads on it); dark mode gets a deep muted tone (light text reads on
 * it). Hero and cook mode share this so a recipe keeps one identity.
 */
export type TonalPair = readonly [string, string];

function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function tonalPair(id: string, dark: boolean): TonalPair {
  const a = hueFor(id);
  const b = (a + 24) % 360;
  return dark
    ? [`hsl(${a}, 32%, 24%)`, `hsl(${b}, 38%, 15%)`]
    : [`hsl(${a}, 58%, 88%)`, `hsl(${b}, 64%, 76%)`];
}

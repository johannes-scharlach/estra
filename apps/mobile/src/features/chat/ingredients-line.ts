/**
 * The ingredients that fit on one line, whole, with "+N" for the rest —
 * never cut mid-word. `firstLine` is what an unclamped layout of the full
 * list put on its first line, so character count stands in for width.
 */
export function ingredientsLine(ingredients: string, firstLine: string): string {
  const room = firstLine.trimEnd().length;
  if (room >= ingredients.length) return ingredients;

  const items = ingredients.split(", ");
  const cut = (shown: number) =>
    `${items.slice(0, shown).join(", ")} +${items.length - shown}`;
  let shown = 1;
  while (shown < items.length - 1 && cut(shown + 1).length <= room) shown++;
  return cut(shown);
}

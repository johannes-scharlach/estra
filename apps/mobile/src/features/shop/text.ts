/** Ingredient names arrive as the recipe wrote them ("lemon", "Kalamata olives"). */
export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Category names arrive in Title Case; the brief wants sentence case. */
export function sentenceCase(text: string) {
  return capitalize(text.toLowerCase());
}

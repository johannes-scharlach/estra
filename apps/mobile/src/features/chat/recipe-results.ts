import type { Parts } from "./stream";

export type RecipeResult = {
  variantId: string;
  name: string;
  plannedMeal?: { id: string; date: string; meal: string };
  shopping?: {
    added: string[];
    removed: string[];
    updated: string[];
    keptBought: string[];
  };
};

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

/** Only completed writes produce recipe links. Merely reading a different
 * version must not redirect the prominent link in the chat. */
export function recipeResults(parts: Parts): RecipeResult[] {
  const results: RecipeResult[] = [];
  for (const part of parts) {
    if (
      part.type !== "tool-updateRecipe" ||
      !("state" in part) ||
      part.state !== "output-available" ||
      !("output" in part)
    )
      continue;
    const output = part.output;
    if (
      !object(output) ||
      typeof output.variantId !== "string" ||
      typeof output.name !== "string"
    )
      continue;
    const result: RecipeResult = {
      variantId: output.variantId,
      name: output.name,
    };
    const meal = output.plannedMeal;
    if (
      object(meal) &&
      typeof meal.id === "string" &&
      typeof meal.date === "string" &&
      typeof meal.meal === "string"
    ) {
      result.plannedMeal = { id: meal.id, date: meal.date, meal: meal.meal };
    }
    const shopping = output.shopping;
    if (object(shopping))
      result.shopping = {
        added: strings(shopping.added),
        removed: strings(shopping.removed),
        updated: strings(shopping.updated),
        keptBought: strings(shopping.keptBought),
      };
    results.push(result);
  }
  return results;
}

export function latestRecipeResult(
  messages: readonly { parts: Parts }[],
): RecipeResult | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const results = recipeResults(messages[index]!.parts);
    if (results.length) return results[results.length - 1]!;
  }
  return null;
}

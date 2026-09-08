import type { MealSlot } from "./plan.js";
import type { Locale } from "./recipe-schema.js";

export type ImportTarget = { listId: string; date: string; slot: MealSlot };
export type ImportRequest = {
  operationId: string;
  url: string;
  context?: string;
  locale: Locale;
  plan?: ImportTarget;
};
export type ImportResult = { recipeId: string; variantId: string };

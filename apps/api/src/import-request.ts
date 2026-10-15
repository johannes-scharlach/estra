import type { MealSlot } from "./plan.js";
import type { Locale } from "./recipe-schema.js";

export type ImportTarget = { listId: string; date: string; slot: MealSlot };
export type ImportRequest = {
  operationId: string;
  url: string;
  context?: string;
  locale: Locale;
  /** The cookbook's household; builds before ADR 27 omit it. */
  listId?: string;
  plan?: ImportTarget;
};
export type ImportResult = { recipeId: string; variantId: string };

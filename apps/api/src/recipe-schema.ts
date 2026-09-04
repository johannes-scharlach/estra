import { z } from "zod";

/**
 * One recipe shape for every way a variant gets written: URL import, the
 * cook's addToCookbook / updateRecipe tools. The zod descriptions double as
 * the model's instructions, so keep them precise.
 */
export const locales = ["en", "de"] as const;
export type Locale = (typeof locales)[number];
export const localeNames: Record<Locale, string> = { en: "English", de: "German" };

export const CATEGORIES = [
  "produce",
  "bakery",
  "dairy",
  "meat",
  "frozen",
  "pantry",
  "drinks",
  "snacks",
  "household",
  "personal",
  "other",
] as const;

const SwapSchema = z.object({
  qty_text: z
    .string()
    .nullable()
    .describe('swap amount, e.g. "1 jar", "200g", null if none'),
  item_name: z
    .string()
    .min(1)
    .describe(
      'swap ingredient name without prep, e.g. "couscous", "canned tuna in olive oil"',
    ),
  prep_note: z
    .string()
    .optional()
    .describe(
      "swap prep, e.g. 'drained', 'thinly sliced' — jarred vs fresh differ here",
    ),
  category_id: z
    .enum(CATEGORIES)
    .optional()
    .describe(
      "REQUIRED: aisle where you BUY the raw item (ignore prep). Omit ONLY for non-purchasable like leftovers.",
    ),
});

const IngredientLineSchema = z.object({
  qty_text: z
    .string()
    .nullable()
    .describe(
      'amount with unit, e.g. "150g", "1-2 tins", "1/2 tsp", null if none like "Freshly ground black pepper"',
    ),
  item_name: z
    .string()
    .min(1)
    .describe(
      'ingredient name WITHOUT quantity or prep, e.g. "bulgur", "sardines in olive oil", "garlic" (prep "thinly sliced" is separate)',
    ),
  prep_note: z
    .string()
    .optional()
    .describe(
      "prep for this line only, e.g. 'rough-chopped', 'thinly sliced', 'crumbled' — not part of item_name",
    ),
  category_id: z
    .enum(CATEGORIES)
    .optional()
    .describe(
      "REQUIRED: aisle where you BUY the raw item before prepping (produce/bakery/dairy/meat/frozen/pantry/drinks/snacks/household/personal/other). Ignore prep_note when picking. Omit ONLY for non-purchasable like leftovers. Use most specific aisle, 'other' only as last resort.",
    ),
  swaps: z
    .array(SwapSchema)
    .optional()
    .describe(
      "1-3 obvious 1:1 swaps for this line, each with its own qty/prep/category — e.g. bulgur -> couscous/orzo, sardines -> tuna; fresh bell pepper (produce, thinly sliced) -> jarred roasted peppers (pantry, drained)",
    ),
});

export const RecipeSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe('dish title as grandma wrote it, e.g. "Chicken Traybake"'),
  description: z
    .string()
    .min(1)
    .describe("one-paragraph appetizer for the dish"),
  locale: z.enum(locales).describe("content language, en or de"),
  totalTime: z
    .string()
    .min(1)
    .describe('e.g. "45 minutes", "1 hour 20 minutes"'),
  recipeYield: z.string().min(1).describe('e.g. "4 servings", "2 portions"'),
  contentMarkdown: z
    .string()
    .optional()
    .describe("rich Markdown with Ingredients, Steps, Prep, Vibe sections"),
  recipeIngredient: z
    .array(IngredientLineSchema)
    .min(1)
    .describe("structured ingredient lines, each with embedded 1:1 swaps"),
  recipeInstructions: z
    .array(
      z.object({
        name: z
          .string()
          .min(1)
          .describe('step group title, e.g. "Marinate the tofu"'),
        ingredients: z
          .array(z.string())
          .describe("ingredient names referenced in this step"),
        text: z.string().min(1).describe("full instruction text"),
        tip: z.string().optional().describe("optional chef tip"),
      }),
    )
    .describe("step-by-step instructions grouped by phase"),
  recipeCategory: z.string().optional().describe('e.g. "Dinner", "Lunch"'),
  recipeCuisine: z
    .string()
    .optional()
    .describe('e.g. "Mediterranean", "Vietnamese"'),
  from: z
    .object({
      name: z.string().min(1).describe("source name"),
      url: z.url().optional().describe("source URL"),
    })
    .optional()
    .describe("provenance of the import"),
});

export type RecipeInput = z.infer<typeof RecipeSchema>;

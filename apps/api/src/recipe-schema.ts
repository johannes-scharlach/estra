import { z } from "zod";

/**
 * One recipe shape for every way a variant gets written: URL import, the
 * cook's addToCookbook / updateRecipe tools. The zod descriptions double as
 * the model's instructions, so keep them precise.
 */
export const locales = ["en", "de"] as const;
export type Locale = (typeof locales)[number];
export const localeNames: Record<Locale, string> = {
  en: "English",
  de: "German",
};

export const CATEGORIES = [
  "produce",
  "bakery",
  "deli",
  "dairy",
  "meat",
  "breakfast",
  "grains",
  "spices",
  "snacks",
  "frozen",
  "beverages",
  "care",
  "household",
  "pets",
  "home",
  "other",
] as const;
export type CategoryId = (typeof CATEGORIES)[number];

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
      "Optional preparation for this swap, not part of item_name. When importing, preserve source ingredient-line prep here and leave instruction prep in the instructions. When creating, prefer prep in the steps; use this sparingly to clarify the measured quantity or a prepared state the instructions assume (e.g. 'drained'). Avoid repeating prep already explained in a step. Omit when absent or unnecessary; never write placeholders such as 'none' or 'N/A'.",
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
      'ingredient name WITHOUT quantity or prep, e.g. "bulgur", "sardines in olive oil", "garlic". Keep purchase distinctions such as "canned tomatoes", "frozen spinach", or "coarse bulgur" in the name.',
    ),
  prep_note: z
    .string()
    .optional()
    .describe(
      "Optional ingredient-line preparation, not part of item_name. When importing, preserve source ingredient-line prep here and leave instruction prep in the instructions. When creating, prefer prep in the steps; use this sparingly to clarify the measured quantity (e.g. 'thawed and squeezed dry') or a prepared state the instructions assume (e.g. 'finely diced' when the steps start with sauteing). Avoid repeating prep already explained in a step. Omit when absent or unnecessary; never write placeholders such as 'none' or 'N/A'.",
    ),
  category_id: z
    .enum(CATEGORIES)
    .optional()
    .describe(
      "REQUIRED: aisle where you BUY the raw item before prepping (produce/bakery/deli/dairy/meat/breakfast/grains/spices/snacks/frozen/beverages/care/household/pets/home/other). Ignore prep_note when picking. Omit ONLY for non-purchasable like leftovers. Use most specific aisle, 'other' only as last resort.",
    ),
  shopping_hint: z
    .enum(["check_at_home", "likely_purchase"])
    .optional()
    .describe(
      "REQUIRED for new recipes: check_at_home only for everyday cooking basics that a household might already have, such as small amounts of salt, oil, water, or common dried seasonings; otherwise likely_purchase. This is a shopping-review suggestion, not a claim about actual inventory. Judge the ingredient in context, not by its supermarket aisle. Older recipes may omit this field; they default to likely_purchase.",
    ),
  swaps: z
    .array(SwapSchema)
    .optional()
    .describe(
      "1-3 obvious 1:1 swaps for this line, each with its own quantity and category, and prep_note only when useful — e.g. bulgur -> couscous/orzo, sardines -> tuna; fresh bell pepper (produce) -> jarred roasted peppers (spices)",
    ),
});

export const RecipeSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe('the full recipe name, e.g. "Chicken Traybake"'),
  description: z
    .string()
    .min(1)
    .describe("a short, appetizing summary of the dish"),
  locale: z
    .enum(locales)
    .describe(
      "the short language code (en or de), without a regional variant; match the language used in the recipe",
    ),
  totalTime: z
    .string()
    .min(1)
    .describe(
      'wall-clock time from the first thing the cook does until the food is ready. Account for parallel work; do not add every step duration together. Examples: "45 minutes", "1 hour 20 minutes"',
    ),
  recipeYield: z
    .string()
    .min(1)
    .describe(
      'who the recipe feeds, e.g. "4 servings" or "2 adults and 2 kids". Decide the yield first and make every ingredient quantity fit it.',
    ),
  contentMarkdown: z
    .string()
    .optional()
    .describe(
      "Use only for useful, recipe-specific context that has no dedicated field, such as toddler tasks, the vibe, serving ideas, or adaptations. Do not include ingredients or step-by-step instructions; those belong in recipeIngredient and recipeInstructions. Omit when there is no useful extra context.",
    ),
  recipeIngredient: z
    .array(IngredientLineSchema)
    .min(1)
    .describe(
      "REQUIRED structured ingredient lines, one per ingredient, with quantity, ingredient name, shopping category, and embedded 1:1 swaps when useful. This is required even when ingredient details also appear in the source text.",
    ),
  recipeInstructions: z
    .array(
      z.object({
        name: z
          .string()
          .min(1)
          .describe(
            'a crisp, short title for the cooking action, e.g. "Marinate the tofu"',
          ),
        ingredients: z
          .array(z.string())
          .describe(
            "specific measured ingredients used in this step (e.g. '1/2 lemon, juiced'). Include only ingredients used together in this action; split unrelated jobs into separate steps.",
          ),
        text: z
          .string()
          .min(1)
          .describe("clear, detailed instructions for this cooking action"),
        tip: z
          .string()
          .optional()
          .describe("an actionable cook-specific tip; omit if none adds value"),
      }),
    )
    .describe(
      "ordered cooking steps. Keep each step to an action in one place; give concurrent jobs separate steps and say what each runs alongside.",
    ),
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

/** A recipe the assistant or the adjust route writes: provenance is ours. */
export const CookRecipeSchema = RecipeSchema.omit({ from: true });
export type CookRecipeInput = z.infer<typeof CookRecipeSchema>;

const SizedForSchema = z.object({
  eater_ids: z
    .array(z.uuid())
    .describe("household person IDs this recipe was actually sized for"),
  extra_portions: z
    .number()
    .min(0)
    .multipleOf(0.01)
    .describe("extra adult portions beyond the named eaters; use 0 for none"),
});

/** A new cookbook recipe can record the household sizing used to write it. */
export const AddToCookbookSchema = CookRecipeSchema.extend({
  sizedFor: SizedForSchema.optional().describe(
    "Include only when the recipe was actually sized for specific household people and extra portions. Use their IDs from the household context; omit if the sizing is not known.",
  ),
});

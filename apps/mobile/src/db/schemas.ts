import { z } from "zod";

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

export const SwapSchema = z.object({
  qty_text: z.string().nullable(),
  item_name: z.string().min(1),
  prep_note: z.string().optional(),
  category_id: z.enum(CATEGORIES).optional(),
});

export const IngredientLineSchema = z.object({
  qty_text: z
    .string()
    .nullable()
    .describe(
      'amount, e.g. "150g", "1-2 tins", null if none like "Freshly ground black pepper"',
    ),
  item_name: z
    .string()
    .min(1)
    .describe("ingredient name without quantity or prep"),
  prep_note: z
    .string()
    .optional()
    .describe("optional extra like 'rough-chopped', 'thinly sliced'"),
  category_id: z.enum(CATEGORIES).optional().describe("supermarket aisle"),
  shopping_hint: z.enum(["check_at_home", "likely_purchase"]).optional(),
  swaps: z
    .array(SwapSchema)
    .optional()
    .describe(
      "1:1 alternatives with own qty/prep — fresh vs jarred differs here",
    ),
});

export const locales = ["en", "de"] as const;

export const InstructionSchema = z.object({
  name: z.string().min(1).describe("crisp, short title for the cooking action"),
  ingredients: z
    .array(z.string())
    .describe("specific measured ingredients used together in this step"),
  text: z
    .string()
    .min(1)
    .describe("clear, detailed instructions for this action"),
  tip: z
    .string()
    .optional()
    .describe("actionable tip; omit if none adds value"),
});

export const LegacySwapSchema = z.object({
  from_item: z.string().min(1),
  to_item: z.string().min(1),
  to_qty: z.string().min(1),
});

export const RecipeImportSchema = z.object({
  name: z.string().min(1).describe('full recipe name, e.g. "Chicken Traybake"'),
  description: z
    .string()
    .min(1)
    .describe("short, appetizing summary of the dish"),
  locale: z
    .enum(locales)
    .describe(
      "short language code without a regional variant; match the recipe language",
    ),
  totalTime: z
    .string()
    .min(1)
    .describe(
      "wall-clock time from starting the recipe until it is ready, accounting for parallel work",
    ),
  recipeYield: z
    .string()
    .min(1)
    .describe(
      "who the recipe feeds; ingredient quantities must fit this yield",
    ),
  contentMarkdown: z
    .string()
    .optional()
    .describe(
      "only useful recipe-specific context with no dedicated field, such as toddler tasks, the vibe, serving ideas, or adaptations. Never repeat ingredients or steps here; omit if there is no extra context.",
    ),
  recipeIngredient: z
    .array(IngredientLineSchema)
    .min(1)
    .describe("required structured ingredient lines, one per ingredient"),
  recipeInstructions: z
    .array(InstructionSchema)
    .describe(
      "ordered cooking steps; keep each action in one place and split concurrent jobs into separate steps",
    ),
  recipeCategory: z.string().optional(),
  recipeCuisine: z.string().optional(),
  from: z
    .object({ name: z.string().min(1), url: z.string().url().optional() })
    .optional(),
});

export type ValidatedRecipeImport = z.infer<typeof RecipeImportSchema>;
export type IngredientLine = z.infer<typeof IngredientLineSchema>;
export type Instruction = z.infer<typeof InstructionSchema>;
export type Swap = z.infer<typeof SwapSchema>;

const IngredientLinesSchema = z.array(IngredientLineSchema).min(1);

export function parseIngredientLinesSafe(raw: string | null): {
  lines: {
    name: string;
    spec: string | null;
    category_id: CategoryId | null;
  }[];
  error?: string;
} {
  if (!raw) return { lines: [], error: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      lines: [],
      error: `JSON parse: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const result = IngredientLinesSchema.safeParse(parsed);
  if (!result.success) return { lines: [], error: result.error.message };
  // Name is the clean ingredient; qty + prep go to spec (see planned-meals.ts).
  const lines = result.data.map((e) => {
    const qty = (e.qty_text ?? "")?.trim() ?? "";
    const spec = [qty, e.prep_note].filter(Boolean).join(", ") || null;
    return { name: e.item_name, spec, category_id: e.category_id ?? null };
  });
  return { lines };
}

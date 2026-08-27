import { z } from 'zod';

export const CATEGORIES = [
  'produce',
  'bakery',
  'dairy',
  'meat',
  'frozen',
  'pantry',
  'drinks',
  'snacks',
  'household',
  'personal',
  'other',
] as const;
export type CategoryId = (typeof CATEGORIES)[number];

export const SwapSchema = z.object({
  qty_text: z.string().nullable(),
  item_name: z.string().min(1),
  prep_note: z.string().optional(),
  category_id: z.enum(CATEGORIES).optional(),
});

export const IngredientLineSchema = z.object({
  qty_text: z.string().nullable().describe('amount, e.g. "150g", "1-2 tins", null if none like "Freshly ground black pepper"'),
  item_name: z.string().min(1).describe('ingredient name without quantity or prep'),
  prep_note: z.string().optional().describe("optional extra like 'rough-chopped', 'thinly sliced'"),
  category_id: z.enum(CATEGORIES).optional().describe('supermarket aisle'),
  swaps: z.array(SwapSchema).optional().describe("1:1 alternatives with own qty/prep — fresh vs jarred differs here"),
});

export const locales = ['en', 'de'] as const;

export const InstructionSchema = z.object({
  name: z.string().min(1).describe('step group title'),
  ingredients: z.array(z.string()),
  text: z.string().min(1).describe('full instruction text'),
  tip: z.string().optional(),
});

export const LegacySwapSchema = z.object({
  from_item: z.string().min(1),
  to_item: z.string().min(1),
  to_qty: z.string().min(1),
});

export const RecipeImportSchema = z.object({
  name: z.string().min(1).describe('dish title, e.g. "Chicken Traybake"'),
  description: z.string().min(1).describe('one-paragraph appetizer'),
  locale: z.enum(locales),
  totalTime: z.string().min(1).describe('e.g. "45 minutes"'),
  recipeYield: z.string().min(1).describe('e.g. "4 servings"'),
  contentMarkdown: z.string().optional().describe('rich Markdown'),
  recipeIngredient: z.array(IngredientLineSchema).min(1).describe('structured ingredient lines'),
  recipeInstructions: z.array(InstructionSchema),
  recipeCategory: z.string().optional(),
  recipeCuisine: z.string().optional(),
  from: z.object({ name: z.string().min(1), url: z.string().url().optional() }).optional(),
});

export type ValidatedRecipeImport = z.infer<typeof RecipeImportSchema>;
export type IngredientLine = z.infer<typeof IngredientLineSchema>;
export type Instruction = z.infer<typeof InstructionSchema>;
export type Swap = z.infer<typeof SwapSchema>;

const IngredientLinesSchema = z.array(IngredientLineSchema).min(1);

export function parseIngredientLinesSafe(raw: string | null): {
  lines: { name: string; spec: string | null; category_id: CategoryId | null }[];
  error?: string;
} {
  if (!raw) return { lines: [], error: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { lines: [], error: `JSON parse: ${e instanceof Error ? e.message : String(e)}` };
  }
  const result = IngredientLinesSchema.safeParse(parsed);
  if (!result.success) return { lines: [], error: result.error.message };
  const lines = result.data.map((e) => {
    const qty = (e.qty_text ?? '')?.trim() ?? '';
    const name = qty ? `${qty} ${e.item_name}`.trim() : e.item_name;
    return { name, spec: e.prep_note ?? null, category_id: e.category_id ?? null };
  });
  return { lines };
}

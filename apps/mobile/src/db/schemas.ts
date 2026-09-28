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
  /** Why a cook would pick this over the line's own ingredient. */
  reason: z.string().optional(),
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

/**
 * The amount a step uses, which can be a share of its ingredient line
 * (150g of the butter for the batter, 75g for the glaze). Steps written
 * before this shape are plain strings.
 */
export const StepIngredientSchema = z.union([
  z.object({
    qty_text: z.string().nullable(),
    item_name: z.string().min(1),
    prep_note: z.string().optional(),
  }),
  z.string(),
]);

export const InstructionSchema = z.object({
  name: z.string().min(1).describe("crisp, short title for the cooking action"),
  ingredients: z
    .array(StepIngredientSchema)
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

export type IngredientLine = z.infer<typeof IngredientLineSchema>;

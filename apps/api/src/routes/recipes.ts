import { randomUUID } from "node:crypto";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { Hono } from "hono";
import { z } from "zod";

import type { AppBindings } from "../auth.js";
import { pool } from "../db.js";
import { env } from "../env.js";

const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });

export const locales = ["en", "de"] as const;
export type Locale = (typeof locales)[number];
const localeNames: Record<Locale, string> = { en: "English", de: "German" };

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

const FromUrlSchema = z.object({
  url: z.url(),
  context: z.string().optional(),
  locale: z.enum(locales).optional().default("en"),
});

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

export const recipes = new Hono<AppBindings>();

recipes.post("/import-from-url", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = FromUrlSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid body", details: z.prettifyError(parsed.error) },
      400,
    );
  }
  const { url, context, locale } = parsed.data;
  const effectiveLocale: Locale = (locale as Locale) ?? "en";

  const result = await generateText({
    model: google("gemini-flash-lite-latest"),
    output: Output.object({
      schema: RecipeSchema.or(z.object({ error: z.string() })),
    }),
    prompt:
      `Fetch the recipe content from the following URL and extract it into JSON. The recipe should be parsed into a rich Markdown format that includes clear sections for Ingredients and Step-by-Step Instructions, as well as any other relevant sections like Prep, Time & Effort, The Vibe, etc. Be sure to capture all the details to make it easy for the user to follow. Write the recipe content in ${localeNames[effectiveLocale]} and set the recipe's \`locale\` field to "${effectiveLocale}". If the page contains multiple recipes, pick the one that seems most relevant based on this additional context: ${context ?? ""}` +
      `\n\nFor recipeIngredient, return an array of {qty_text, item_name, prep_note, category_id, swaps} objects:` +
      `\n- qty_text: amount with unit (e.g. "150g", "1-2 tins", "1/2 tsp", null if none like "Freshly ground black pepper").` +
      `\n- item_name: raw ingredient name WITHOUT qty or prep (e.g. "garlic" not "1 clove garlic thinly sliced", "bulgur" not "bulgur medium or coarse" — prep goes in prep_note).` +
      `\n- prep_note: how to prep that item for this recipe (e.g. "thinly sliced", "rough-chopped", "drained").` +
      `\n- category_id: REQUIRED for every purchasable ingredient — the supermarket aisle where you BUY the raw item BEFORE prepping. Must be one of ${CATEGORIES.join(",")}. Choose the most specific: garlic/lemon/herbs=fresh produce, bulgur/olives/olive oil=pantry, feta=dairy. Ignore the prep when picking the aisle. "1 clove garlic, thinly sliced" is produce, not other. Only omit category_id for truly non-purchasable items like "leftovers". Use "other" only as last resort, not default.` +
      `\nFor swaps, list 1-3 obvious 1:1 alternatives for that line — each swap is {qty_text, item_name, prep_note, category_id} with its own qty/prep/category (same BUY-aisle rule; fresh bell pepper "thinly sliced" is produce, jarred roasted peppers "drained" is pantry). Examples: bulgur (pantry) -> couscous / orzo, sardines in olive oil (pantry) -> canned tuna. Only include clearly equivalent swaps, not inventive ones.` +
      `\n\nURL: ${url}\n\nRespond with the extracted recipe in JSON format according to the provided schema. If you fail to extract a recipe, respond with {"error": "reason for failure"}.`,
    tools: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      urlContext: (google.tools as any).urlContext({}),
    },
  });

  const output = result.output as
    | z.infer<typeof RecipeSchema>
    | { error: string }
    | undefined;
  if (!output || "error" in output) {
    return c.json(
      {
        error: output?.error ?? "Failed to extract recipe",
      },
      422,
    );
  }

  // Direct Postgres insert — no client round-trip. PowerSync syncs it to devices.
  // ADR 8: recipes is thin, variants holds all display fields + ingredient swaps inline.
  const recipeId = randomUUID();
  const variantId = randomUUID();
  const userId = c.get("user").id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO recipes (id, from_name, from_url, created_by)
       VALUES ($1,$2,$3,$4)`,
      [recipeId, output.from?.name ?? null, output.from?.url ?? null, userId],
    );
    await client.query(
      `INSERT INTO variants (id, recipe_id, name, description, locale, total_time, recipe_yield, content_markdown, recipe_category, recipe_cuisine, ingredient_lines, instructions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)`,
      [
        variantId,
        recipeId,
        output.name,
        output.description,
        output.locale,
        output.totalTime,
        output.recipeYield,
        output.contentMarkdown ?? null,
        output.recipeCategory ?? null,
        output.recipeCuisine ?? null,
        JSON.stringify(output.recipeIngredient),
        JSON.stringify(output.recipeInstructions),
      ],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("recipe insert failed", e);
    return c.json({ error: "Failed to save recipe" }, 500);
  } finally {
    client.release();
  }

  return c.json({ id: recipeId, variantId, recipe: output });
});

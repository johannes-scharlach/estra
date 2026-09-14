import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { Hono } from "hono";
import { z } from "zod";

import type { AppBindings } from "../auth.js";
import { env } from "../env.js";
import {
  CATEGORIES,
  localeNames,
  locales,
  RecipeSchema,
  type Locale,
} from "../recipe-schema.js";
import { MEAL_SLOTS } from "../plan.js";
import { findCompletedImport, saveImport } from "../import-and-plan.js";
import { AppError } from "../errors.js";

const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });

const FromUrlSchema = z.object({
  url: z.url(),
  operationId: z.uuid(),
  plan: z
    .object({
      listId: z.string(),
      date: z.iso.date(),
      slot: z.enum(MEAL_SLOTS),
    })
    .optional(),
  context: z.string().optional(),
  locale: z.enum(locales).optional().default("en"),
});

export const recipes = new Hono<AppBindings>();

recipes.post("/import-from-url", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = FromUrlSchema.safeParse(body);
  if (!parsed.success) {
    console.error("Invalid import request:", parsed.error.flatten());
    throw new AppError(
      "INVALID_REQUEST",
      "Check the recipe URL and meal slot.",
      400,
    );
  }
  const request = parsed.data;
  const { url, context, locale } = request;
  const userId = c.get("user").id;
  const existing = await findCompletedImport(userId, request);
  if (existing) return c.json(existing);
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
      `\n- category_id: REQUIRED for every purchasable ingredient — the supermarket aisle where you BUY the raw item BEFORE prepping. Must be one of ${CATEGORIES.join(",")}. Choose the most specific: garlic/lemon/herbs=produce, bulgur/pasta/rice=grains, olives/olive oil/spices/canned tomatoes=spices, feta/parmesan/salami/tofu=deli, milk/butter/yogurt/cream=dairy, raw poultry/beef/fish=meat, coffee/oats/jam=breakfast. Ignore the prep when picking the aisle. "1 clove garlic, thinly sliced" is produce, not other. Only omit category_id for truly non-purchasable items like "leftovers". Use "other" only as last resort, not default.` +
      `\nFor swaps, list 1-3 obvious 1:1 alternatives for that line — each swap is {qty_text, item_name, prep_note, category_id} with its own qty/prep/category (same BUY-aisle rule; fresh bell pepper "thinly sliced" is produce, jarred roasted peppers "drained" is spices). Examples: bulgur (grains) -> couscous / orzo, sardines in olive oil (spices) -> canned tuna. Only include clearly equivalent swaps, not inventive ones.` +
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
    throw new AppError(
      "RECIPE_EXTRACTION_FAILED",
      "Could not read a recipe from that URL.",
      422,
    );
  }
  const saved = await saveImport(userId, request, output);
  return c.json(saved);
});

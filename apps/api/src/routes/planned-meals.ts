import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { Hono } from "hono";
import { z } from "zod";

import { deriveVariantIdForAdjust } from "../adjust-identity.js";
import {
  adjustPrompt,
  loadAdjustContext,
  saveAdjusted,
} from "../adjust-planned-meal.js";
import type { AppBindings } from "../auth.js";
import { env } from "../env.js";
import { AppError } from "../errors.js";
import { CookRecipeSchema } from "../recipe-schema.js";

const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });

// Rewriting a whole recipe with scaled amounts needs the fuller model, like
// the conversational turn; lite is fine while developing.
const ADJUST_MODEL =
  process.env.NODE_ENV === "production"
    ? "gemini-flash-latest"
    : "gemini-flash-lite-latest";

const AdjustSchema = z.object({ operationId: z.uuid() });

export const plannedMeals = new Hono<AppBindings>();

/** Spec 0004: a new version sized for the meal, swaps folded in, meal repointed. */
plannedMeals.post("/:id/adjust", async (c) => {
  const plannedMealId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = AdjustSchema.safeParse(body);
  if (!parsed.success || !z.uuid().safeParse(plannedMealId).success) {
    throw new AppError("INVALID_REQUEST", "Check the meal and try again.", 400);
  }
  const userId = c.get("user").id;
  const variantId = deriveVariantIdForAdjust(
    userId,
    parsed.data.operationId,
    plannedMealId,
  );
  const loaded = await loadAdjustContext(userId, plannedMealId, variantId);
  if ("existing" in loaded) return c.json(loaded.existing);

  const result = await generateText({
    model: google(ADJUST_MODEL),
    output: Output.object({ schema: CookRecipeSchema }),
    prompt: adjustPrompt(loaded.context),
  });
  const recipe = result.output;
  if (!recipe) {
    throw new AppError(
      "RECIPE_ADJUST_FAILED",
      "Could not adjust the recipe. Try again.",
      422,
    );
  }
  const saved = await saveAdjusted({
    userId,
    plannedMealId,
    variantId,
    context: loaded.context,
    recipe,
  });
  return c.json(saved);
});

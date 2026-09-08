import { z } from "zod";

import { powersync } from "@/db/system";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { ImportFailure } from "./import-failure";
import type { ImportRequest, ImportResult, ImportTarget } from "./import-jobs";

const ImportResultSchema = z.object({
  recipeId: z.uuid(),
  variantId: z.uuid(),
});
const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const permanentErrors = new Set([
  "MEAL_SLOT_OCCUPIED",
  "LIST_ACCESS_DENIED",
  "VARIANT_NOT_FOUND",
  "INVALID_REQUEST",
  "RECIPE_EXTRACTION_FAILED",
]);

export async function importRecipe(
  request: Omit<ImportRequest, "plan"> & { plan?: ImportTarget },
): Promise<ImportResult> {
  const { data } = await supabase.auth.getSession();
  if (!data.session)
    throw new ImportFailure(
      "UNAUTHORIZED",
      "Sign in to import a recipe.",
      true,
    );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${env.apiUrl}/v1/recipes/import-from-url`, {
      signal: controller.signal,
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify(request),
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const parsed = ApiErrorSchema.safeParse(body);
      if (parsed.success) {
        const { code, message } = parsed.data.error;
        throw new ImportFailure(code, message, !permanentErrors.has(code));
      }
      throw new ImportFailure(
        "INVALID_RESPONSE",
        "The server could not complete the import. Try again.",
        true,
      );
    }
    const parsed = ImportResultSchema.safeParse(body);
    if (!parsed.success)
      throw new ImportFailure(
        "INVALID_RESPONSE",
        "Could not read the import result. Try again.",
        true,
      );
    return parsed.data;
  } catch (error) {
    if (error instanceof ImportFailure) throw error;
    throw new ImportFailure(
      controller.signal.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
      controller.signal.aborted
        ? "The request timed out. Retry to check whether it completed."
        : "Could not reach the server. Please try again.",
      true,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function waitForMeal(
  target: ImportTarget,
  result: ImportResult,
): Promise<void> {
  const deadline = Date.now() + 30000;
  for (;;) {
    const meal = await powersync.getOptional(
      `SELECT p.id FROM planned_meals p JOIN variants v ON v.id = p.variant_id
       WHERE p.list_id = ? AND p.slot_date = ? AND p.meal = ? AND p.variant_id = ?`,
      [target.listId, target.date, target.slot, result.variantId],
    );
    if (meal) return;
    if (Date.now() >= deadline) {
      throw new ImportFailure(
        "SYNC_TIMEOUT",
        "Saved, but not visible here yet. Retry to check again.",
        true,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

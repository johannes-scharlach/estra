import { z } from "zod";

import { waitForVariant } from "@/db/variants";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { ImportFailure } from "./import-failure";

const ResultSchema = z.object({ recipeId: z.uuid(), variantId: z.uuid() });
const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const permanentErrors = new Set([
  "PLANNED_MEAL_NOT_FOUND",
  "PLANNED_MEAL_CHANGED",
  "LIST_ACCESS_DENIED",
  "VARIANT_NOT_FOUND",
  "INVALID_REQUEST",
]);

/**
 * Ask the API to write the recipe version this meal needs (spec 0004), then
 * wait for that version to sync down so the page can open it. The same
 * operation id on retry returns the finished result instead of writing twice.
 */
export async function adjustPlannedMeal(request: {
  plannedMealId: string;
  operationId: string;
}): Promise<{ recipeId: string; variantId: string }> {
  const { data } = await supabase.auth.getSession();
  if (!data.session)
    throw new ImportFailure("UNAUTHORIZED", "Sign in to adjust a recipe.", true);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  let result: { recipeId: string; variantId: string };
  try {
    const response = await fetch(
      `${env.apiUrl}/v1/planned-meals/${request.plannedMealId}/adjust`,
      {
        signal: controller.signal,
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ operationId: request.operationId }),
      },
    );
    const body: unknown = await response.json();
    if (!response.ok) {
      const parsed = ApiErrorSchema.safeParse(body);
      if (parsed.success) {
        const { code, message } = parsed.data.error;
        throw new ImportFailure(code, message, !permanentErrors.has(code));
      }
      throw new ImportFailure(
        "INVALID_RESPONSE",
        "The server could not adjust the recipe. Try again.",
        true,
      );
    }
    const parsed = ResultSchema.safeParse(body);
    if (!parsed.success)
      throw new ImportFailure(
        "INVALID_RESPONSE",
        "Could not read the result. Try again.",
        true,
      );
    result = parsed.data;
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
  if (!(await waitForVariant(result.variantId)))
    throw new ImportFailure(
      "SYNC_TIMEOUT",
      "Adjusted, but not visible here yet. Retry to check again.",
      true,
    );
  return result;
}

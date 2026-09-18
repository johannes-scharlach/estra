import { estraUuidV5 } from "./estra-uuid.js";

/**
 * Adjusting a planned meal twice with the same operation writes one variant:
 * a retry after a timeout finds the finished result instead of writing again.
 * Keep the input encoding stable.
 */
export function deriveVariantIdForAdjust(
  userId: string,
  operationId: string,
  plannedMealId: string,
): string {
  return estraUuidV5(
    JSON.stringify(["meal-adjust", userId, operationId, plannedMealId]),
  );
}

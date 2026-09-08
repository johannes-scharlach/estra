import { estraUuidV5 } from "./estra-uuid.js";
import type { ImportRequest } from "./import-request.js";

/**
 * Repeating the same import request produces the same variant ID, so a retry
 * can recognize an earlier successful save. Keep the input encoding stable.
 */
export function deriveVariantIdForImport(userId: string, request: ImportRequest): string {
  const { operationId, url, context, locale, plan } = request;
  return estraUuidV5(JSON.stringify([
    "recipe-import", userId, operationId, url, context ?? null, locale,
    plan ? [plan.listId, plan.date, plan.slot] : null,
  ]));
}

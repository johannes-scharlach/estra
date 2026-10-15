import type { Client } from "pg";

import { inTransaction, pool } from "./db.js";
import { setPlannedMeal } from "./plan.js";
import type { RecipeInput } from "./recipe-schema.js";
import {
  createRecipe,
  findVariantIdentity,
  insertVariant,
} from "./variants.js";
import { ListAccessError } from "./errors.js";
import type { ImportRequest } from "./import-request.js";
import { deriveVariantIdForImport } from "./import-identity.js";
import {
  assertListMember,
  assertListMemberUntilCommit,
} from "./list-authorization.js";

export async function findCompletedImport(
  userId: string,
  request: ImportRequest,
) {
  const client = await pool.connect();
  try {
    if (request.plan)
      await assertListMember(client, userId, request.plan.listId);
    return await findVariantIdentity(
      client,
      deriveVariantIdForImport(userId, request),
    );
  } finally {
    client.release();
  }
}

/** Import and optional planning commit together; retries return the exact result. */
export async function saveImport(
  userId: string,
  request: ImportRequest,
  recipe: RecipeInput,
) {
  const variantId = deriveVariantIdForImport(userId, request);
  return inTransaction(userId, async (client) => {
    const listId =
      request.plan?.listId ?? request.listId ?? (await firstListOf(client, userId));
    await assertListMemberUntilCommit(client, userId, listId);
    await serializeImportSaves(client, variantId);
    const existing = await findVariantIdentity(client, variantId);
    if (existing) return existing;

    const recipeId = await createRecipe(client, {
      userId,
      listId,
      origin: "import",
      from: recipe.from,
    });
    const saved = await insertVariant(client, { recipeId, variantId, recipe });
    if (request.plan) {
      const { listId, date, slot } = request.plan;
      await setPlannedMeal(client, {
        listId,
        slotDate: date,
        meal: slot,
        variantId,
        ifOccupied: "reject",
      });
    }
    return saved;
  });
}

/** Where an import from a build that sends no list lands (ADR 27). */
async function firstListOf(client: Client, userId: string): Promise<string> {
  const first = await client.query<{ list_id: string }>(
    "SELECT list_id FROM list_members WHERE user_id = $1 ORDER BY joined_at, list_id LIMIT 1",
    [userId],
  );
  if (!first.rows[0]) throw new ListAccessError();
  return first.rows[0].list_id;
}

/**
 * Requires an open transaction. Waits for another save of this import to finish;
 * the caller must then check for its result before writing. The lock is released
 * automatically on commit or rollback. Recipe extraction is not serialized.
 */
async function serializeImportSaves(
  transaction: Client,
  variantId: string,
): Promise<void> {
  await transaction.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [variantId],
  );
}

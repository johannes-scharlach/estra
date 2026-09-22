import type { SizedFor } from "@estra/meals";
import { z } from "zod";

import { powersync } from "./system";
import type { Variant } from "./schema";
import { IngredientLineSchema, InstructionSchema } from "./schemas";
import type { IngredientLine } from "./schemas";

// ---------------------------------------------------------------------------
// Thin DAL for the variants table — SQLite stores jsonb columns as TEXT
// (see apps/mobile/src/db/schema.ts and docs/schema-changes.md). Callers
// work with ParsedVariant (real arrays); this module handles
// JSON.stringify/JSON.parse at the boundary. Keep AppSchema raw.
// ADR 8: variants is the cookable entity (random id), ingredient_lines
// carries inline swaps per line [{qty_text,item_name,prep_note,category_id}].
// ---------------------------------------------------------------------------

const IngredientLinesZ = z.array(IngredientLineSchema);
const InstructionsZ = z.array(InstructionSchema);
const SizedForZ = z.object({
  eater_ids: z.array(z.string()),
  extra_portions: z.number(),
});

export type ParsedVariant = Omit<
  Variant,
  "ingredient_lines" | "instructions" | "sized_for"
> & {
  ingredientLines: z.infer<typeof IngredientLineSchema>[];
  instructions: z.infer<typeof InstructionSchema>[];
  /** Who the adjust route sized it for; null as imported, or if the stamp is unreadable. */
  sizedFor: SizedFor | null;
};

function parseJson<T>(raw: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return schema.parse(parsed);
}

/** Parse the ingredient_lines jsonb column (TEXT in SQLite). Throws on partial-sync garbage. */
export function parseIngredientLines(raw: string | null): IngredientLine[] {
  return parseJson(raw ?? "[]", IngredientLinesZ);
}

export function parseVariant(row: Variant): ParsedVariant {
  const instructionsRaw = row.instructions ?? "[]";
  return {
    ...row,
    ingredientLines: parseIngredientLines(row.ingredient_lines),
    instructions: parseJson(instructionsRaw, InstructionsZ),
    sizedFor: parseSizedFor(row.sized_for),
  };
}

/** A stamp that doesn't parse is no stamp: the recipe then counts as sized as written. */
function parseSizedFor(raw: string | null): SizedFor | null {
  if (!raw) return null;
  try {
    return parseJson(raw, SizedForZ);
  } catch {
    return null;
  }
}

export function serializeVariant(parsed: ParsedVariant): Variant {
  return {
    ...parsed,
    ingredient_lines: JSON.stringify(parsed.ingredientLines),
    instructions: JSON.stringify(parsed.instructions),
    sized_for: parsed.sizedFor ? JSON.stringify(parsed.sizedFor) : null,
  };
}

// Convenience helpers — thin wrappers around raw SQL, still explicit SQL
// so PowerSync's watched-query tracking and view semantics stay visible.

export async function getVariant(
  tx: { getOptional: (sql: string, params: unknown[]) => Promise<unknown> },
  id: string,
): Promise<ParsedVariant | null> {
  const row = (await tx.getOptional(`SELECT * FROM variants WHERE id = ?`, [
    id,
  ])) as Variant | null | undefined;
  return row ? parseVariant(row) : null;
}

/**
 * Wait for a variant to arrive in local SQLite. Server-side imports insert
 * into Postgres; planning against the new variant needs the row synced down
 * first (setPlannedMeal projects its ingredient_lines into list_items).
 */
export async function waitForVariant(
  id: string,
  timeoutMs = 15000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const row = await powersync.getOptional(
      `SELECT id FROM variants WHERE id = ?`,
      [id],
    );
    if (row) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 300));
  }
}

export async function getVariantForRecipe(
  tx: { getOptional: (sql: string, params: unknown[]) => Promise<unknown> },
  recipeId: string,
): Promise<ParsedVariant | null> {
  const row = (await tx.getOptional(
    `SELECT * FROM variants WHERE recipe_id = ? ORDER BY created_at DESC LIMIT 1`,
    [recipeId],
  )) as Variant | null | undefined;
  return row ? parseVariant(row) : null;
}

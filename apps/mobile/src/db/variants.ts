import { z } from 'zod';

import type { Variant } from './schema';
import { IngredientLineSchema, InstructionSchema } from './schemas';

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

export type ParsedVariant = Omit<Variant, 'ingredient_lines' | 'instructions'> & {
  ingredientLines: z.infer<typeof IngredientLineSchema>[];
  instructions: z.infer<typeof InstructionSchema>[];
};

/** Columns that are jsonb in Postgres, TEXT in SQLite. */
export const VARIANT_JSON_COLUMNS = new Set(['ingredient_lines', 'instructions'] as const);

function parseJson<T>(raw: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  return schema.parse(parsed);
}

export function parseVariant(row: Variant): ParsedVariant {
  const ingredientLinesRaw = row.ingredient_lines ?? '[]';
  const instructionsRaw = row.instructions ?? '[]';
  return {
    ...row,
    ingredientLines: parseJson(ingredientLinesRaw, IngredientLinesZ),
    instructions: parseJson(instructionsRaw, InstructionsZ),
  };
}

export function serializeVariant(parsed: ParsedVariant): Variant {
  return {
    ...parsed,
    ingredient_lines: JSON.stringify(parsed.ingredientLines),
    instructions: JSON.stringify(parsed.instructions),
  };
}

/** Decode a raw SQLite row map for upload — string -> object for Postgres jsonb. */
export function decodeVariantForUpload(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const col of VARIANT_JSON_COLUMNS) {
    const v = out[col];
    if (typeof v === 'string') {
      try {
        out[col] = JSON.parse(v);
      } catch (e) {
        const err = new Error(`Invalid JSON in ${col}: ${e instanceof Error ? e.message : String(e)}`) as Error & { code: string };
        err.code = '22P02';
        throw err;
      }
    }
  }
  return out;
}

// Convenience helpers — thin wrappers around raw SQL, still explicit SQL
// so PowerSync's watched-query tracking and view semantics stay visible.

export async function getVariant(
  tx: { getOptional: (sql: string, params: unknown[]) => Promise<unknown> },
  id: string,
): Promise<ParsedVariant | null> {
  const row = (await tx.getOptional(`SELECT * FROM variants WHERE id = ?`, [id])) as Variant | null | undefined;
  return row ? parseVariant(row) : null;
}

export async function getVariantForRecipe(
  tx: { getOptional: (sql: string, params: unknown[]) => Promise<unknown> },
  recipeId: string,
): Promise<ParsedVariant | null> {
  const row = (await tx.getOptional(`SELECT * FROM variants WHERE recipe_id = ? ORDER BY created_at DESC LIMIT 1`, [recipeId])) as Variant | null | undefined;
  return row ? parseVariant(row) : null;
}

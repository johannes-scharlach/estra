import { randomUUID } from "node:crypto";

import { v5 as uuidv5 } from "uuid";

import { pool } from "./db.js";

/**
 * Server-side twin of apps/mobile/src/db/planned-meals.ts. Same ids, same
 * projection of a variant's ingredient lines into list_items (ADR 7), so a
 * meal planned by the cook and one planned by hand are indistinguishable.
 * Change both together.
 */
const ESTRA_NAMESPACE = "6f9a1c2e-2b7a-5f3d-9c41-0e8b6d5a4f77";

export const MEAL_SLOTS = ["lunch", "dinner", "treat"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export function plannedMealId(listId: string, slotDate: string, meal: string): string {
  return uuidv5(`${listId}:${slotDate}:${meal}`, ESTRA_NAMESPACE);
}

function itemNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

type Line = { qty_text?: string | null; item_name: string; prep_note?: string; category_id?: string };

export async function setPlannedMeal(opts: {
  listId: string;
  slotDate: string;
  meal: MealSlot;
  variantId: string;
  servings?: number;
}): Promise<{ plannedMealId: string; name: string | null; items: string[] }> {
  const { listId, slotDate, meal, variantId } = opts;
  const id = plannedMealId(listId, slotDate, meal);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const v = await client.query<{ recipe_id: string; name: string | null; ingredient_lines: Line[] }>(
      "SELECT recipe_id, name, ingredient_lines FROM variants WHERE id = $1",
      [variantId],
    );
    const variant = v.rows[0];
    if (!variant) throw new Error("No such recipe");

    await client.query(
      `INSERT INTO planned_meals (id, list_id, recipe_id, variant_id, slot_date, meal, servings)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE
         SET recipe_id = EXCLUDED.recipe_id, variant_id = EXCLUDED.variant_id,
             servings = EXCLUDED.servings, updated_at = now()`,
      [id, listId, variant.recipe_id, variantId, slotDate, meal, opts.servings ?? 2],
    );

    await client.query("DELETE FROM list_items WHERE planned_meal_id = $1", [id]);
    const items: string[] = [];
    for (const line of variant.ingredient_lines) {
      const qty = (line.qty_text ?? "").trim();
      const spec = [qty, line.prep_note].filter(Boolean).join(", ") || null;
      await client.query(
        `INSERT INTO list_items (id, list_id, name, name_key, category_id, spec, status, purchase_count, planned_meal_id, variant_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', 0, $7, $8)`,
        [randomUUID(), listId, line.item_name, itemNameKey(line.item_name), line.category_id ?? null, spec, id, variantId],
      );
      items.push(spec ? `${line.item_name} (${spec})` : line.item_name);
    }
    await client.query("COMMIT");
    return { plannedMealId: id, name: variant.name, items };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function clearPlannedMeal(listId: string, slotDate: string, meal: MealSlot): Promise<boolean> {
  const id = plannedMealId(listId, slotDate, meal);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM list_items WHERE planned_meal_id = $1", [id]);
    const res = await client.query("DELETE FROM planned_meals WHERE id = $1", [id]);
    await client.query("COMMIT");
    return (res.rowCount ?? 0) > 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function readPlan(listId: string, fromDate: string, days = 14) {
  const rows = await pool.query<{
    slot_date: string;
    meal: string;
    servings: number;
    variant_id: string;
    name: string | null;
  }>(
    `SELECT p.slot_date, p.meal, p.servings, p.variant_id, v.name
     FROM planned_meals p JOIN variants v ON v.id = p.variant_id
     WHERE p.list_id = $1 AND p.slot_date >= $2 AND p.slot_date < ($2::date + $3::int)::text
     ORDER BY p.slot_date, p.meal`,
    [listId, fromDate, days],
  );
  return rows.rows.map((r) => ({
    date: r.slot_date,
    meal: r.meal,
    servings: r.servings,
    variantId: r.variant_id,
    name: r.name,
  }));
}

import type { PoolClient } from "pg";

import { estraUuidV5 } from "./estra-uuid.js";
import { pool } from "./db.js";
import {
  MealSlotOccupiedError,
  UnknownHouseholdPersonError,
  VariantNotFoundError,
} from "./errors.js";

/**
 * Server-side twin of apps/mobile/src/db/planned-meals.ts. Same ids, same
 * calendar-only writes, so a meal planned by the cook and one planned by
 * hand are indistinguishable. Shopping is an explicit choice (ADR 16).
 * Change both together.
 */
export const MEAL_SLOTS = ["lunch", "dinner", "treat"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export function plannedMealId(listId: string, slotDate: string, meal: string): string {
  return estraUuidV5(`${listId}:${slotDate}:${meal}`);
}

type Person = { id: string; name: string };

async function householdPeople(client: PoolClient, listId: string): Promise<Person[]> {
  const rows = await client.query<Person>(
    "SELECT id, name FROM household_people WHERE list_id = $1 ORDER BY created_at, id",
    [listId],
  );
  return rows.rows;
}

/**
 * A planned meal is who from the household is eating plus extra portions
 * (ADR 12). Eaters default to the whole household, extra to none.
 */
export async function setPlannedMeal(client: PoolClient, opts: {
  listId: string;
  slotDate: string;
  meal: MealSlot;
  variantId: string;
  eaterIds?: string[];
  extraPortions?: number;
  ifOccupied: "reject" | "replace";
}): Promise<{ plannedMealId: string; name: string | null; items: string[] }> {
  const { listId, slotDate, meal, variantId } = opts;
  const extraPortions = opts.extraPortions ?? 0;
  if (!Number.isFinite(extraPortions) || extraPortions < 0 || Number(extraPortions.toFixed(2)) !== extraPortions) {
    throw new Error("Extra portions must be zero or more with at most two decimal places");
  }
  const people = await householdPeople(client, listId);
  const eaterIds = opts.eaterIds ?? people.map((p) => p.id);
  const known = new Set(people.map((p) => p.id));
  if (eaterIds.some((id) => !known.has(id))) throw new UnknownHouseholdPersonError();

  const id = plannedMealId(listId, slotDate, meal);
  const v = await client.query<{ recipe_id: string; name: string | null }>(
    "SELECT recipe_id, name FROM variants WHERE id = $1",
    [variantId],
  );
  const variant = v.rows[0];
  if (!variant) throw new VariantNotFoundError();

  const written = await client.query(
    `INSERT INTO planned_meals (id, list_id, recipe_id, variant_id, slot_date, meal, eater_ids, extra_portions)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     ${opts.ifOccupied === "reject" ? "ON CONFLICT (id) DO NOTHING" : `ON CONFLICT (id) DO UPDATE
        SET recipe_id = EXCLUDED.recipe_id, variant_id = EXCLUDED.variant_id, name = NULL,
            shopping_reviewed_variant_id = NULL,
           content_id = EXCLUDED.content_id,
           eater_ids = EXCLUDED.eater_ids, extra_portions = EXCLUDED.extra_portions,
           updated_at = now()`}
     RETURNING id`,
    [id, listId, variant.recipe_id, variantId, slotDate, meal, JSON.stringify(eaterIds), extraPortions],
  );

  if (!written.rowCount) throw new MealSlotOccupiedError();

  await client.query("DELETE FROM list_items WHERE planned_meal_id = $1", [id]);
  return { plannedMealId: id, name: variant.name, items: [] };
}

export async function clearPlannedMeal(client: PoolClient, listId: string, slotDate: string, meal: MealSlot): Promise<boolean> {
  const id = plannedMealId(listId, slotDate, meal);
  await client.query("DELETE FROM list_items WHERE planned_meal_id = $1", [id]);
  const res = await client.query("DELETE FROM planned_meals WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function readPlan(listId: string, fromDate: string, days = 14) {
  const people = (
    await pool.query<Person>(
      "SELECT id, name FROM household_people WHERE list_id = $1 ORDER BY created_at, id",
      [listId],
    )
  ).rows;
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const rows = await pool.query<{
    slot_date: string;
    meal: string;
    eater_ids: string[];
    extra_portions: number;
    variant_id: string | null;
    name: string | null;
  }>(
    `SELECT p.slot_date, p.meal, p.eater_ids, p.extra_portions, p.variant_id, COALESCE(p.name, v.name) AS name
     FROM planned_meals p LEFT JOIN variants v ON v.id = p.variant_id
     WHERE p.list_id = $1 AND p.slot_date >= $2 AND p.slot_date < ($2::date + $3::int)::text
     ORDER BY p.slot_date, p.meal`,
    [listId, fromDate, days],
  );
  return rows.rows.map((r) => {
    // People removed from the household since are not eating anymore.
    const eaters = r.eater_ids.filter((id) => nameOf.has(id));
    return {
      date: r.slot_date,
      meal: r.meal,
      variantId: r.variant_id,
      name: r.name,
      eaters: eaters.map((id) => nameOf.get(id)),
      everyone: people.length > 0 && eaters.length === people.length,
      extraPortions: r.extra_portions,
    };
  });
}

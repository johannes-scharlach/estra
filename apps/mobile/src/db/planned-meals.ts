import * as Crypto from 'expo-crypto';
import { estraUuidV5 } from "@/lib/estra-uuid";
import { isValidPortions } from '@/features/meals/portions';
import type { MealSlot } from '@/features/meals/slots';

import { powersync } from './system';
import { getVariant, getVariantForRecipe } from './variants';

import { itemNameKey } from './items';


export function plannedMealId(listId: string, slotDate: string, meal: string): string {
  return estraUuidV5(`${listId}:${slotDate}:${meal}`);
}

async function syncListItemsForMeal(tx: any, listId: string, plannedMealIdValue: string, variantIdValue: string) {
  await tx.execute(`DELETE FROM list_items WHERE planned_meal_id = ?`, [plannedMealIdValue]);

  const variant = await getVariant(tx, variantIdValue);
  if (!variant) throw new Error(`variant ${variantIdValue} not found`);
  const lines = variant.ingredientLines.map((e) => {
    // Name stays the clean ingredient ("Fresh parsley"); qty + prep go to
    // spec so the list reads like a shopping list, not a recipe line.
    const qty = (e.qty_text ?? '').trim();
    const spec = [qty, e.prep_note].filter(Boolean).join(', ') || null;
    return { name: e.item_name, spec, category_id: e.category_id ?? null };
  });
  const now = new Date().toISOString();
  for (const line of lines) {
    const nameKey = itemNameKey(line.name);
    const itemId = Crypto.randomUUID();
    await tx.execute(
      `INSERT INTO list_items (id, list_id, name, name_key, category_id, spec, status, purchase_count, created_at, updated_at, planned_meal_id, variant_id)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?, ?)`,
      [itemId, listId, line.name, nameKey, line.category_id, line.spec, now, now, plannedMealIdValue, variantIdValue],
    );
  }
}

/**
 * Plan a recipe into a slot. One row per slot (list_id + slot_date + meal).
 * Deterministic id so offline concurrent writes to same slot converge.
 * Picks the latest variant for the recipe (ADR 8: random ids, technique variants are distinct).
 * Also projects the variant's ingredient_lines into list_items (meal-derived rows, random ids, ADR 7).
 */
export async function setPlannedMeal(opts: {
  listId: string;
  slotDate: string;
  meal: string;
  recipeId: string;
  variantId?: string;
  servings?: number;
}) {
  const { listId, slotDate, meal, recipeId } = opts;
  const id = plannedMealId(listId, slotDate, meal);
  const now = new Date().toISOString();
  const servings = opts.servings ?? 2;
  if (!isValidPortions(servings)) throw new Error('Portions must be positive with at most two decimal places');

  await powersync.writeTransaction(async (tx) => {
    let vId = opts.variantId;
    if (!vId) {
      const v = await getVariantForRecipe(tx, recipeId);
      if (!v) throw new Error(`no variant for recipe ${recipeId}`);
      vId = v.id;
    }
    const existing = (await tx.getOptional(`SELECT id FROM planned_meals WHERE id = ?`, [id])) as
      | { id: string }
      | null
      | undefined;
    if (existing) {
      await tx.execute(
        `UPDATE planned_meals SET recipe_id = ?, variant_id = ?, servings = ?, updated_at = ? WHERE id = ?`,
        [recipeId, vId, servings, now, id],
      );
    } else {
      await tx.execute(
        `INSERT INTO planned_meals (id, list_id, recipe_id, variant_id, slot_date, meal, servings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, listId, recipeId, vId, slotDate, meal, servings, now, now],
      );
    }
    await syncListItemsForMeal(tx, listId, id, vId);
  });
}

export async function clearPlannedMeal(listId: string, slotDate: string, meal: string) {
  const id = plannedMealId(listId, slotDate, meal);
  await powersync.writeTransaction(async (tx) => {
    await tx.execute(`DELETE FROM list_items WHERE planned_meal_id = ?`, [id]);
    await tx.execute(`DELETE FROM planned_meals WHERE id = ?`, [id]);
  });
}

export async function updatePlannedMealServings(
  listId: string,
  slotDate: string,
  meal: MealSlot,
  variantId: string,
  servings: number,
): Promise<void> {
  if (!isValidPortions(servings)) throw new Error('Portions must be positive with at most two decimal places');
  const id = plannedMealId(listId, slotDate, meal);
  await powersync.writeTransaction(async (tx) => {
    const existing = await tx.getOptional(
      `SELECT id FROM planned_meals WHERE id = ? AND variant_id = ?`,
      [id, variantId],
    );
    if (!existing) throw new Error('Planned meal not found');
    await tx.execute(
      `UPDATE planned_meals SET servings = ?, updated_at = ? WHERE id = ?`,
      [servings, new Date().toISOString(), id],
    );
  });
}

export async function movePlannedMeal(
  listId: string,
  from: { date: string; slot: MealSlot; variantId: string },
  to: { date: string; slot: MealSlot },
): Promise<void> {
  const fromId = plannedMealId(listId, from.date, from.slot);
  const toId = plannedMealId(listId, to.date, to.slot);

  await powersync.writeTransaction(async (tx) => {
    const source = (await tx.getOptional(`SELECT recipe_id, variant_id, servings FROM planned_meals WHERE id = ?`, [
      fromId,
    ])) as { recipe_id: string; variant_id: string; servings: number } | null | undefined;
    if (!source) throw new Error('Planned meal not found');
    if (source.variant_id !== from.variantId) throw new Error('Planned meal changed');
    if (fromId === toId) return;

    const target = (await tx.getOptional(`SELECT recipe_id, variant_id, servings FROM planned_meals WHERE id = ?`, [
      toId,
    ])) as { recipe_id: string; variant_id: string; servings: number } | null | undefined;

    const now = new Date().toISOString();

    if (target) {
      // Keep slot ids, swap contents, then refresh both item projections.
      await tx.execute(
        `UPDATE planned_meals SET recipe_id = ?, variant_id = ?, servings = ?, updated_at = ? WHERE id = ?`,
        [source.recipe_id, source.variant_id, source.servings, now, toId],
      );
      await tx.execute(
        `UPDATE planned_meals SET recipe_id = ?, variant_id = ?, servings = ?, updated_at = ? WHERE id = ?`,
        [target.recipe_id, target.variant_id, target.servings, now, fromId],
      );
      await syncListItemsForMeal(tx, listId, toId, source.variant_id);
      await syncListItemsForMeal(tx, listId, fromId, target.variant_id);
    } else {
      // The new slot needs its deterministic id and a fresh item projection.
      await tx.execute(`DELETE FROM planned_meals WHERE id = ?`, [fromId]);
      await tx.execute(
        `INSERT INTO planned_meals (id, list_id, recipe_id, variant_id, slot_date, meal, servings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [toId, listId, source.recipe_id, source.variant_id, to.date, to.slot, source.servings, now, now],
      );
      // Local SQLite does not cascade the Postgres foreign key.
      await tx.execute(`DELETE FROM list_items WHERE planned_meal_id = ?`, [fromId]);
      await syncListItemsForMeal(tx, listId, toId, source.variant_id);
    }
  });
}

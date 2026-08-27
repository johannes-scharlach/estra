import * as Crypto from 'expo-crypto';
import { v5 as uuidv5 } from 'uuid';

import { powersync } from './system';
import { getVariant, getVariantForRecipe } from './variants';

import { itemNameKey } from './items';

const ESTRA_NAMESPACE = '6f9a1c2e-2b7a-5f3d-9c41-0e8b6d5a4f77';

export function plannedMealId(listId: string, slotDate: string, meal: string): string {
  return uuidv5(`${listId}:${slotDate}:${meal}`, ESTRA_NAMESPACE);
}

async function syncListItemsForMeal(tx: any, listId: string, plannedMealIdValue: string, variantIdValue: string) {
  await tx.execute(`DELETE FROM list_items WHERE planned_meal_id = ?`, [plannedMealIdValue]);

  const variant = await getVariant(tx, variantIdValue);
  if (!variant) throw new Error(`variant ${variantIdValue} not found`);
  const lines = variant.ingredientLines.map((e) => {
    const qty = (e.qty_text ?? '').trim();
    const name = qty ? `${qty} ${e.item_name}`.trim() : e.item_name;
    return { name, spec: e.prep_note ?? null, category_id: e.category_id ?? null };
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

export async function movePlannedMeal(
  listId: string,
  slotDate: string,
  fromMeal: string,
  toMeal: string,
) {
  const fromId = plannedMealId(listId, slotDate, fromMeal);
  const toId = plannedMealId(listId, slotDate, toMeal);

  await powersync.writeTransaction(async (tx) => {
    const from = (await tx.getOptional(`SELECT recipe_id, variant_id, servings FROM planned_meals WHERE id = ?`, [
      fromId,
    ])) as { recipe_id: string; variant_id: string; servings: number } | null | undefined;
    if (!from) return;

    const to = (await tx.getOptional(`SELECT recipe_id, variant_id, servings FROM planned_meals WHERE id = ?`, [
      toId,
    ])) as { recipe_id: string; variant_id: string; servings: number } | null | undefined;

    const now = new Date().toISOString();

    if (to) {
      // swap — keep ids, swap contents, then refresh both item projections
      await tx.execute(
        `UPDATE planned_meals SET recipe_id = ?, variant_id = ?, servings = ?, updated_at = ? WHERE id = ?`,
        [from.recipe_id, from.variant_id, from.servings, now, toId],
      );
      await tx.execute(
        `UPDATE planned_meals SET recipe_id = ?, variant_id = ?, servings = ?, updated_at = ? WHERE id = ?`,
        [to.recipe_id, to.variant_id, to.servings, now, fromId],
      );
      await syncListItemsForMeal(tx, listId, toId, from.variant_id);
      await syncListItemsForMeal(tx, listId, fromId, to.variant_id);
    } else {
      // move — re-id the planned meal and move its items
      await tx.execute(`DELETE FROM planned_meals WHERE id = ?`, [fromId]);
      await tx.execute(
        `INSERT INTO planned_meals (id, list_id, recipe_id, variant_id, slot_date, meal, servings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [toId, listId, from.recipe_id, from.variant_id, slotDate, toMeal, from.servings, now, now],
      );
      // Move list_items to new planned_meal_id (keep variant_id)
      // Delete from old (already cascaded by planned_meal delete, but ensure) and recreate via sync for consistency
      await tx.execute(`DELETE FROM list_items WHERE planned_meal_id = ?`, [fromId]);
      await tx.execute(`DELETE FROM list_items WHERE planned_meal_id = ?`, [toId]);
      const variantMove = await getVariant(tx, from.variant_id);
      if (!variantMove) throw new Error(`variant ${from.variant_id} not found`);
      const lines = variantMove.ingredientLines.map((e) => {
        const qty = (e.qty_text ?? '').trim();
        const name = qty ? `${qty} ${e.item_name}`.trim() : e.item_name;
        return { name, spec: e.prep_note ?? null, category_id: e.category_id ?? null };
      });
      for (const line of lines) {
        const nameKey = itemNameKey(line.name);
        const itemId = Crypto.randomUUID();
        await tx.execute(
          `INSERT INTO list_items (id, list_id, name, name_key, category_id, spec, status, purchase_count, created_at, updated_at, planned_meal_id, variant_id)
           VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?, ?)`,
          [itemId, listId, line.name, nameKey, line.category_id, line.spec, now, now, toId, from.variant_id],
        );
      }
    }
  });
}

import * as Crypto from "expo-crypto";
import { estraUuidV5 } from "@/lib/estra-uuid";
import { isValidExtraPortions } from "@/features/meals/eaters";
import type { MealSlot } from "@/features/meals/slots";

import { powersync } from "./system";
import { getVariant, getVariantForRecipe } from "./variants";

export function plannedMealId(
  listId: string,
  slotDate: string,
  meal: string,
): string {
  return estraUuidV5(`${listId}:${slotDate}:${meal}`);
}

/** Everyone in the household, the default for a meal nobody has narrowed. */
async function householdEaterIds(tx: any, listId: string): Promise<string[]> {
  const rows = (await tx.getAll(
    `SELECT id FROM household_people WHERE list_id = ? ORDER BY created_at, id`,
    [listId],
  )) as { id: string }[];
  return rows.map((r) => r.id);
}

function assertValidExtra(extraPortions: number) {
  if (!isValidExtraPortions(extraPortions))
    throw new Error(
      "Extra portions must be zero or more with at most two decimal places",
    );
}

/**
 * Plan a recipe into a slot. One row per slot (list_id + slot_date + meal).
 * Deterministic id so offline concurrent writes to same slot converge.
 * Picks the latest variant for the recipe (ADR 8: random ids, technique variants are distinct).
 * Shopping is a separate, explicit choice (ADR 16).
 * Eaters default to the whole household and extra to none (ADR 12).
 */
export async function setPlannedMeal(opts: {
  listId: string;
  slotDate: string;
  meal: string;
  recipeId: string;
  variantId?: string;
  eaterIds?: string[];
  extraPortions?: number;
}) {
  const { listId, slotDate, meal, recipeId } = opts;
  const id = plannedMealId(listId, slotDate, meal);
  const now = new Date().toISOString();
  const extraPortions = opts.extraPortions ?? 0;
  assertValidExtra(extraPortions);

  await powersync.writeTransaction(async (tx) => {
    let vId = opts.variantId;
    if (!vId) {
      const v = await getVariantForRecipe(tx, recipeId);
      if (!v) throw new Error(`no variant for recipe ${recipeId}`);
      vId = v.id;
    }
    const variant = await getVariant(tx, vId);
    if (!variant || variant.recipe_id !== recipeId)
      throw new Error("Recipe variant not found");
    const eaterIds = JSON.stringify(
      opts.eaterIds ?? (await householdEaterIds(tx, listId)),
    );
    const existing = (await tx.getOptional(
      `SELECT id FROM planned_meals WHERE id = ?`,
      [id],
    )) as { id: string } | null | undefined;
    if (existing) {
      await tx.execute(
        `UPDATE planned_meals SET recipe_id = ?, variant_id = ?, name = NULL, content_id = ?, eater_ids = ?, extra_portions = ?, shopping_reviewed_variant_id = NULL, updated_at = ? WHERE id = ?`,
        [recipeId, vId, Crypto.randomUUID(), eaterIds, extraPortions, now, id],
      );
    } else {
      await tx.execute(
        `INSERT INTO planned_meals (id, list_id, recipe_id, variant_id, content_id, slot_date, meal, eater_ids, extra_portions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          listId,
          recipeId,
          vId,
          Crypto.randomUUID(),
          slotDate,
          meal,
          eaterIds,
          extraPortions,
          now,
          now,
        ],
      );
    }
    await tx.execute("DELETE FROM list_items WHERE planned_meal_id = ?", [id]);
  });
}

export async function clearPlannedMeal(
  listId: string,
  slotDate: string,
  meal: string,
) {
  const id = plannedMealId(listId, slotDate, meal);
  await powersync.writeTransaction(async (tx) => {
    await tx.execute(`DELETE FROM list_items WHERE planned_meal_id = ?`, [id]);
    await tx.execute(`DELETE FROM planned_meals WHERE id = ?`, [id]);
  });
}

/** Written meals are complete plans. Saving creates no recipe or shopping items.
 * Editing the text preserves any shopping help the user has already requested. */
export async function setWrittenMeal(opts: {
  listId: string;
  slotDate: string;
  meal: MealSlot;
  name: string;
  expectedName?: string;
}) {
  const name = opts.name.trim();
  if (!name) throw new Error("Write a name for this meal.");
  const id = plannedMealId(opts.listId, opts.slotDate, opts.meal);
  await powersync.writeTransaction(async (tx) => {
    const existing = await tx.getOptional<{
      name: string | null;
      variant_id: string | null;
    }>("SELECT name, variant_id FROM planned_meals WHERE id = ?", [id]);
    const now = new Date().toISOString();
    if (opts.expectedName !== undefined) {
      if (
        !existing ||
        existing.variant_id ||
        existing.name !== opts.expectedName
      )
        throw new Error("This meal has changed. Open it again to edit.");
      await tx.execute(
        "UPDATE planned_meals SET name = ?, updated_at = ? WHERE id = ?",
        [name, now, id],
      );
    } else {
      if (existing)
        throw new Error("This slot already has a meal. Choose another slot.");
      const eaters = JSON.stringify(await householdEaterIds(tx, opts.listId));
      await tx.execute(
        `INSERT INTO planned_meals (id, list_id, name, content_id, slot_date, meal, eater_ids, extra_portions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          id,
          opts.listId,
          name,
          Crypto.randomUUID(),
          opts.slotDate,
          opts.meal,
          eaters,
          now,
          now,
        ],
      );
    }
  });
}

/** Who is eating and how much extra. Never touches the recipe or its items. */
export async function updatePlannedMealEaters(
  listId: string,
  slotDate: string,
  meal: MealSlot,
  variantId: string | null,
  eaterIds: string[],
  extraPortions: number,
): Promise<void> {
  assertValidExtra(extraPortions);
  const id = plannedMealId(listId, slotDate, meal);
  await powersync.writeTransaction(async (tx) => {
    const existing = await tx.getOptional(
      `SELECT id FROM planned_meals WHERE id = ? AND variant_id IS ?`,
      [id, variantId],
    );
    if (!existing) throw new Error("Planned meal not found");
    await tx.execute(
      `UPDATE planned_meals SET eater_ids = ?, extra_portions = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(eaterIds), extraPortions, new Date().toISOString(), id],
    );
  });
}

type Slot = {
  recipe_id: string | null;
  variant_id: string | null;
  name: string | null;
  content_id: string;
  eater_ids: string;
  extra_portions: number;
  shopping_reviewed_variant_id: string | null;
};

/** Copy the saved version, never resolve the recipe's latest version. */
export async function repeatPlannedMeal(
  listId: string,
  from: { date: string; slot: MealSlot; variantId: string | null },
  to: { date: string; slot: MealSlot },
) {
  const fromId = plannedMealId(listId, from.date, from.slot);
  const toId = plannedMealId(listId, to.date, to.slot);
  await powersync.writeTransaction(async (tx) => {
    const source = await tx.getOptional<Slot>(
      "SELECT * FROM planned_meals WHERE id = ?",
      [fromId],
    );
    if (!source || source.variant_id !== from.variantId)
      throw new Error("Planned meal changed. Open it again.");
    if (
      await tx.getOptional("SELECT id FROM planned_meals WHERE id = ?", [toId])
    )
      throw new Error("This slot already has a meal. Choose another slot.");
    const now = new Date().toISOString();
    const known = new Set(await householdEaterIds(tx, listId));
    const eaters = JSON.stringify(
      (JSON.parse(source.eater_ids) as string[]).filter((id) => known.has(id)),
    );
    await tx.execute(
      `INSERT INTO planned_meals (id, list_id, recipe_id, variant_id, name, content_id, slot_date, meal, eater_ids, extra_portions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        toId,
        listId,
        source.recipe_id,
        source.variant_id,
        source.name,
        Crypto.randomUUID(),
        to.date,
        to.slot,
        eaters,
        source.extra_portions,
        now,
        now,
      ],
    );
  });
}

export async function movePlannedMeal(
  listId: string,
  from: { date: string; slot: MealSlot; variantId: string | null },
  to: { date: string; slot: MealSlot },
): Promise<void> {
  const fromId = plannedMealId(listId, from.date, from.slot);
  const toId = plannedMealId(listId, to.date, to.slot);

  await powersync.writeTransaction(async (tx) => {
    const source = (await tx.getOptional(
      `SELECT recipe_id, variant_id, name, content_id, eater_ids, extra_portions, shopping_reviewed_variant_id FROM planned_meals WHERE id = ?`,
      [fromId],
    )) as Slot | null | undefined;
    if (!source) throw new Error("Planned meal not found");
    if (source.variant_id !== from.variantId)
      throw new Error("Planned meal changed");
    if (fromId === toId) return;

    const target = (await tx.getOptional(
      `SELECT recipe_id, variant_id, name, content_id, eater_ids, extra_portions, shopping_reviewed_variant_id FROM planned_meals WHERE id = ?`,
      [toId],
    )) as Slot | null | undefined;

    const now = new Date().toISOString();

    if (target) {
      // Keep slot ids and carry the actual shopping rows, including purchases.
      await tx.execute(
        `UPDATE planned_meals SET recipe_id = ?, variant_id = ?, name = ?, content_id = ?, eater_ids = ?, extra_portions = ?, shopping_reviewed_variant_id = ?, updated_at = ? WHERE id = ?`,
        [
          source.recipe_id,
          source.variant_id,
          source.name,
          source.content_id,
          source.eater_ids,
          source.extra_portions,
          source.shopping_reviewed_variant_id,
          now,
          toId,
        ],
      );
      await tx.execute(
        `UPDATE planned_meals SET recipe_id = ?, variant_id = ?, name = ?, content_id = ?, eater_ids = ?, extra_portions = ?, shopping_reviewed_variant_id = ?, updated_at = ? WHERE id = ?`,
        [
          target.recipe_id,
          target.variant_id,
          target.name,
          target.content_id,
          target.eater_ids,
          target.extra_portions,
          target.shopping_reviewed_variant_id,
          now,
          fromId,
        ],
      );
      await tx.execute(
        `UPDATE list_items SET planned_meal_id = CASE WHEN planned_meal_id = ? THEN ? ELSE ? END, updated_at = ?
         WHERE planned_meal_id IN (?, ?)`,
        [fromId, toId, fromId, now, fromId, toId],
      );
    } else {
      // Create the destination before moving rows so their FK stays valid on upload.
      await tx.execute(
        `INSERT INTO planned_meals (id, list_id, recipe_id, variant_id, name, content_id, slot_date, meal, eater_ids, extra_portions, shopping_reviewed_variant_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          toId,
          listId,
          source.recipe_id,
          source.variant_id,
          source.name,
          source.content_id,
          to.date,
          to.slot,
          source.eater_ids,
          source.extra_portions,
          source.shopping_reviewed_variant_id,
          now,
          now,
        ],
      );
      await tx.execute(
        "UPDATE list_items SET planned_meal_id = ?, updated_at = ? WHERE planned_meal_id = ?",
        [toId, now, fromId],
      );
      await tx.execute(`DELETE FROM planned_meals WHERE id = ?`, [fromId]);
    }
  });
}

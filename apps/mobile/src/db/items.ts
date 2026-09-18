import { itemNameKey } from "@estra/meals";

import { estraUuidV5 } from "@/lib/estra-uuid";

import { powersync } from './system';

// The dedupe key lives in @estra/meals so the API projects the same
// name_key; re-exported here because every item write in the app uses it.
export { itemNameKey };

/**
 * Ids for list_items are derived from (list_id, name_key) rather than
 * random, so that two people adding "milk" while both offline generate the
 * *same* id. Their writes then converge on one row through PowerSync's
 * upsert instead of racing the unique constraint — where the loser would
 * come back as a 23505 and be discarded, silently losing someone's add.
 */
export function itemId(listId: string, name: string): string {
  return estraUuidV5(`${listId}:${itemNameKey(name)}`);
}

/**
 * Add an item, or bring it back if it is sitting in the recent strip.
 * Idempotent by construction: same list plus same name is the same row.
 */
export async function addItem(listId: string, name: string, spec?: string) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const id = itemId(listId, trimmed);
  const nameKey = itemNameKey(trimmed);
  const now = new Date().toISOString();

  // PowerSync's local tables are views over ps_data__*, and SQLite has no
  // UPSERT on a view — so the read and the branch happen here instead, in
  // one write transaction to keep it atomic.
  return powersync.writeTransaction(async (tx) => {
    const existing = await tx.getOptional<{ id: string; spec: string | null; category_id: string | null }>(
      `SELECT id, spec, category_id FROM list_items WHERE id = ?`,
      [id],
    );

    if (existing) {
      await tx.execute(
        `UPDATE list_items
            SET status     = 'active',
                name       = ?,
                spec       = COALESCE(?, spec),
                updated_at = ?
          WHERE id = ?`,
        [trimmed, spec ?? null, now, id],
      );
      return { id, name: trimmed, spec: spec ?? existing.spec, categoryId: existing.category_id };
    }

    // Seeded or legacy rows may have a random id while still sharing the same
    // (list_id, name_key). Updating them keeps the local device consistent
    // and avoids the server-side partial unique violation.
    const legacy = await tx.getOptional<{ id: string; spec: string | null; category_id: string | null }>(
      `SELECT id, spec, category_id FROM list_items
        WHERE list_id = ? AND name_key = ? AND planned_meal_id IS NULL
        LIMIT 1`,
      [listId, nameKey],
    );

    if (legacy) {
      await tx.execute(
        `UPDATE list_items
            SET status     = 'active',
                name       = ?,
                spec       = COALESCE(?, spec),
                updated_at = ?
          WHERE id = ?`,
        [trimmed, spec ?? null, now, legacy.id],
      );
      return { id: legacy.id, name: trimmed, spec: spec ?? legacy.spec, categoryId: legacy.category_id };
    }

    await tx.execute(
      `INSERT INTO list_items
         (id, list_id, name, name_key, category_id, spec, status, purchase_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, 'active', 0, ?, ?)`,
      [id, listId, trimmed, nameKey, spec ?? null, now, now],
    );
    return { id, name: trimmed, spec: spec ?? null, categoryId: null };
  });
}

export async function setItemSpec(id: string, spec: string) {
  await powersync.execute(
    `UPDATE list_items SET spec = ?, updated_at = ? WHERE id = ?`,
    [spec.trim() || null, new Date().toISOString(), id],
  );
}

export async function setItemStatus(id: string, status: 'active' | 'purchased') {
  const now = new Date().toISOString();

  // purchase_count only climbs on the active -> purchased edge, so
  // toggling a checkbox back and forth does not inflate the ranking.
  await powersync.execute(
    `UPDATE list_items
        SET status = ?,
            purchase_count = purchase_count + CASE
              WHEN ? = 'purchased' AND status = 'active' THEN 1 ELSE 0
            END,
            updated_at = ?
      WHERE id = ?`,
    [status, status, now, id],
  );
}

export async function setItemCategory(id: string, categoryId: string | null) {
  await powersync.execute(
    `UPDATE list_items SET category_id = ?, updated_at = ? WHERE id = ?`,
    [categoryId, new Date().toISOString(), id],
  );
}

/** Rename an item in place (custom edit from the item sheet). */
export async function renameItem(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await powersync.execute(
    `UPDATE list_items SET name = ?, name_key = ?, updated_at = ? WHERE id = ?`,
    [trimmed, itemNameKey(trimmed), new Date().toISOString(), id],
  );
}

/**
 * Apply a variant swap to a list item: new clean name plus the swap's qty
 * and prep note folded into spec, so the row re-files under the right
 * section and still reads like a shopping-list line.
 */
export async function applySwap(
  id: string,
  opts: { name: string; qtyText: string | null; prepNote: string | null; categoryId: string | null },
) {
  const trimmed = opts.name.trim();
  if (!trimmed) return;
  const spec = [(opts.qtyText ?? '').trim(), opts.prepNote].filter(Boolean).join(', ') || null;
  await powersync.execute(
    `UPDATE list_items SET name = ?, name_key = ?, spec = ?, category_id = ?, updated_at = ? WHERE id = ?`,
    [trimmed, itemNameKey(trimmed), spec, opts.categoryId, new Date().toISOString(), id],
  );
}

export async function removeItem(id: string) {
  await powersync.execute(`DELETE FROM list_items WHERE id = ?`, [id]);
}

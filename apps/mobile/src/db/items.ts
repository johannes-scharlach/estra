import { v5 as uuidv5 } from 'uuid';

import { powersync } from './system';

/**
 * Fixed namespace for deriving Estra's deterministic ids. Arbitrary but
 * must never change — changing it re-ids every item in existence.
 */
const ESTRA_NAMESPACE = '6f9a1c2e-2b7a-5f3d-9c41-0e8b6d5a4f77';

/**
 * The dedupe key. 'Oat Milk  ' and 'oat milk' are the same thing on a
 * shopping list, so they collapse to one row.
 */
export function itemNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Ids for list_items are derived from (list_id, name_key) rather than
 * random, so that two people adding "milk" while both offline generate the
 * *same* id. Their writes then converge on one row through PowerSync's
 * upsert instead of racing the unique constraint — where the loser would
 * come back as a 23505 and be discarded, silently losing someone's add.
 */
export function itemId(listId: string, name: string): string {
  return uuidv5(`${listId}:${itemNameKey(name)}`, ESTRA_NAMESPACE);
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
  await powersync.writeTransaction(async (tx) => {
    const existing = await tx.getOptional<{ id: string }>(
      `SELECT id FROM list_items WHERE id = ?`,
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
      return;
    }

    await tx.execute(
      `INSERT INTO list_items
         (id, list_id, name, name_key, category_id, spec, status, purchase_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, 'active', 0, ?, ?)`,
      [id, listId, trimmed, nameKey, spec ?? null, now, now],
    );
  });
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

import * as Crypto from 'expo-crypto';
import { v5 as uuidv5 } from 'uuid';

import { ESTRA_NAMESPACE } from './items';
import { powersync } from './system';

/**
 * Create a list and add the creator as its first member, atomically.
 * The member id is deterministic (uuidv5 of list:user) so the same
 * bootstrap running twice converges instead of duplicating membership.
 */
export async function createList(name: string, userId: string | undefined) {
  if (!userId) return;
  const listId = Crypto.randomUUID();
  const now = new Date().toISOString();
  await powersync.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO lists (id, name, invite_code, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [listId, name, Crypto.randomUUID().replace(/-/g, '').slice(0, 12), userId, now, now],
    );
    await tx.execute(
      `INSERT INTO list_members (id, list_id, user_id, joined_at) VALUES (?, ?, ?, ?)`,
      [uuidv5(`${listId}:${userId}`, ESTRA_NAMESPACE), listId, userId, now],
    );
  });
}

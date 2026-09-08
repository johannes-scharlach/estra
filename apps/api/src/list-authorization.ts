import type { Client } from "pg";

import { ListAccessError } from "./errors.js";

/** Throws ListAccessError if the user is not currently a member of the list. */
export async function assertListMember(
  client: Client,
  userId: string,
  listId: string,
): Promise<void> {
  const membership = await client.query(
    "SELECT 1 FROM list_members WHERE list_id = $1 AND user_id = $2",
    [listId, userId],
  );
  if (!membership.rowCount) throw new ListAccessError();
}

/**
 * Requires an open transaction. Throws ListAccessError for a non-member;
 * otherwise prevents membership removal until this transaction commits or rolls back.
 */
export async function assertListMemberUntilCommit(
  transaction: Client,
  userId: string,
  listId: string,
): Promise<void> {
  const membership = await transaction.query(
    "SELECT 1 FROM list_members WHERE list_id = $1 AND user_id = $2 FOR SHARE",
    [listId, userId],
  );
  if (!membership.rowCount) throw new ListAccessError();
}

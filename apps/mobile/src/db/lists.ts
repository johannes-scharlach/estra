import {
  newPerson,
  newProfile,
  personSchema,
  type Household,
} from "@estra/profile";
import * as Crypto from "expo-crypto";

import { insertList, insertPerson, insertProfile } from "./household-writes";
import { powersync } from "./system";

/**
 * A new household, started as a copy of the one you came from: its Profile,
 * and you as the one person. The others stay behind; they can be invited.
 * One local commit, so the app never sees a list without its Profile.
 */
export async function createHousehold(
  name: string,
  userId: string,
  from: Household | null,
): Promise<string> {
  const listId = Crypto.randomUUID();
  const you = from?.people.find((p) => p.user_id === userId);
  const person = personSchema.parse({
    ...(you ?? { ...newPerson(""), name: "Me" }),
    id: Crypto.randomUUID(),
    user_id: userId,
  });
  const now = new Date().toISOString();
  await powersync.writeTransaction(async (tx) => {
    await insertList(tx, {
      id: listId,
      name: listName(name),
      inviteCode: Crypto.randomUUID().replace(/-/g, "").slice(0, 12),
      userId,
      now,
    });
    await insertProfile(tx, listId, from?.profile ?? newProfile(), now);
    await insertPerson(tx, listId, person, now);
  });
  return listId;
}

export async function renameList(listId: string, name: string) {
  await powersync.execute(
    "UPDATE lists SET name = ?, updated_at = ? WHERE id = ?",
    [listName(name), new Date().toISOString(), listId],
  );
}

function listName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter a name.");
  return trimmed;
}

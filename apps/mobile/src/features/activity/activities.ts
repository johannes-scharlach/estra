import { useQuery } from "@powersync/react";
import { useMemo } from "react";

import { powersync } from "@/db/system";

import type { MealActivity } from "./meal-activity-text";

type Recipient = {
  /** Recipient ID: seen state belongs to this user, not the shared activity. */
  id: string;
  activity_id: string;
  list_id: string;
  user_id: string;
  occurred_at: string;
  seen_at: string | null;
};

export type HouseholdActivity = Recipient &
  ({ kind: "member_joined"; actor_name: string } | MealActivity);

export function useActivities(
  listId: string | null,
  userId: string | null,
  preview: boolean,
) {
  const { data, isLoading, error } = useQuery<HouseholdActivity>(
    `SELECT r.id, r.activity_id, r.list_id, r.user_id, r.seen_at,
       a.kind, a.actor_name, a.occurred_at, a.meal_name, a.slot_date, a.meal,
       a.previous_meal_name, a.previous_slot_date, a.previous_meal
     FROM household_activity_recipients r
     JOIN household_activities a ON a.id = r.activity_id AND a.list_id = r.list_id
     WHERE r.list_id = ? AND r.user_id = ?
     ORDER BY a.occurred_at DESC, a.id DESC${preview ? " LIMIT 4" : ""}`,
    [listId, userId],
  );
  // A watched query can briefly retain its previous household/account's result.
  const activities = useMemo(
    () =>
      data.filter((row) => row.list_id === listId && row.user_id === userId),
    [data, listId, userId],
  );
  return { activities, isLoading, error };
}

export async function markActivitiesSeen(
  ids: readonly string[],
  listId: string,
  userId: string,
) {
  const seenAt = new Date().toISOString();
  await powersync.writeTransaction(async (tx) => {
    for (const id of ids) {
      await tx.execute(
        `UPDATE household_activity_recipients SET seen_at = ?
         WHERE id = ? AND list_id = ? AND user_id = ? AND seen_at IS NULL`,
        [seenAt, id, listId, userId],
      );
    }
  });
}

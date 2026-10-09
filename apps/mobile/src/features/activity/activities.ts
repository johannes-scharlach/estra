import { useQuery } from "@powersync/react";
import { useMemo } from "react";

import { powersync } from "@/db/system";

import type { ListActivity } from "./list-activity-text";
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
  (
    | { kind: "member_joined"; actor_name: string }
    | MealActivity
    | ListActivity
  );

export function isListActivity(
  activity: HouseholdActivity,
): activity is Recipient & ListActivity {
  return activity.kind === "items_added" || activity.kind === "items_bought";
}

/** SQLite holds `item_names` as JSON text. */
type Row = Omit<HouseholdActivity, "item_names"> & { item_names: string | null };

export function useActivities(
  listId: string | null,
  userId: string | null,
  preview: boolean,
) {
  const { data, isLoading, error } = useQuery<Row>(
    `SELECT r.id, r.activity_id, r.list_id, r.user_id, r.seen_at,
       a.kind, a.actor_name, a.occurred_at, a.meal_name, a.slot_date, a.meal,
       a.previous_meal_name, a.previous_slot_date, a.previous_meal, a.item_names
     FROM household_activity_recipients r
     JOIN household_activities a ON a.id = r.activity_id AND a.list_id = r.list_id
     WHERE r.list_id = ? AND r.user_id = ?
     ORDER BY a.occurred_at DESC, a.id DESC${preview ? " LIMIT 4" : ""}`,
    [listId, userId],
  );
  // A watched query can briefly retain its previous household/account's result.
  const activities = useMemo(
    () =>
      data
        .filter((row) => row.list_id === listId && row.user_id === userId)
        .map(
          (row) =>
            ({
              ...row,
              item_names: row.item_names ? JSON.parse(row.item_names) : null,
            }) as HouseholdActivity,
        ),
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

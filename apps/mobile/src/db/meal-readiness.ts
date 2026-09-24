import { supabase } from "@/lib/supabase";
import { powersync } from "./system";
import type { PlannedMeal } from "./schema";

/** Chat reads server truth. Let a just-written meal and its shopping edits upload
 * before opening the first turn; offline failures remain retryable in chat. */
export async function waitForPlannedMeal(
  listId: string,
  id: string,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    while (!controller.signal.aborted) {
      if ((await powersync.getUploadQueueStats()).count > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      const local = await powersync.getOptional<PlannedMeal>(
        "SELECT * FROM planned_meals WHERE id = ? AND list_id = ?",
        [id, listId],
      );
      if (!local) throw new Error("This meal is no longer planned.");
      const { data, error } = await supabase
        .from("planned_meals")
        .select("name, variant_id, content_id, eater_ids, extra_portions")
        .eq("id", id)
        .eq("list_id", listId)
        .abortSignal(controller.signal)
        .maybeSingle();
      if (error) throw error;
      if (
        data &&
        data.content_id === local.content_id &&
        data.name === local.name &&
        data.variant_id === local.variant_id &&
        JSON.stringify(data.eater_ids) ===
          JSON.stringify(JSON.parse(local.eater_ids ?? "[]")) &&
        data.extra_portions === local.extra_portions
      )
        return;
      throw new Error(
        "This meal has not synced yet. Please try again shortly.",
      );
    }
    throw new Error(
      "This meal is still syncing. Please try again when online.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

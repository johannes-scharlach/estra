import { supabase } from "@/lib/supabase";
import { powersync } from "./system";

/** Network actions need the newly created membership, not an empty global queue. */
export async function waitForListMembership(listId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Not signed in");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    while (!controller.signal.aborted) {
      const member = await supabase
        .from("list_members")
        .select("id")
        .eq("list_id", listId)
        .eq("user_id", userId)
        .abortSignal(controller.signal)
        .maybeSingle();
      if (member.error) throw member.error;
      if (member.data) return;
      if ((await powersync.getUploadQueueStats()).count === 0)
        throw new Error(
          "Your household membership is not available. Please sign in again.",
        );
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new Error(
      "Your household is still syncing. Please try again shortly.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

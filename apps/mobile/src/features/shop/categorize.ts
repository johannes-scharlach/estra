import { setItemCategory } from "@/db/items";
import { CATEGORIES, type CategoryId } from "@/db/schemas";
import { powersync } from "@/db/system";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * Asynchronously classifies a shopping list item using the backend API.
 * Non-blocking: failures, timeouts, and network issues are caught silently
 * so the add flow remains responsive and works seamlessly offline.
 */
export async function categorizeItemAsync(
  itemId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed || !itemId) return;

  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${env.apiUrl}/v1/items/categorize`, {
      signal: controller.signal,
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: trimmed }),
    });
    clearTimeout(timeout);

    if (!response.ok) return;

    const body = (await response.json()) as { categoryId?: string };
    const categoryId = body?.categoryId as CategoryId | undefined;

    if (!categoryId || !CATEGORIES.includes(categoryId)) return;

    // Only assign category if the item still exists and still has no category assigned
    // (i.e. user hasn't manually set a category in the meantime).
    const current = await powersync.getOptional<{ category_id: string | null }>(
      "SELECT category_id FROM list_items WHERE id = ?",
      [itemId],
    );
    if (!current || current.category_id !== null) return;

    await setItemCategory(itemId, categoryId);
  } catch (err) {
    // Non-blocking: background auto-categorisation failure leaves the item as Uncategorised.
    console.warn("Background auto-categorisation failed:", err);
  }
}

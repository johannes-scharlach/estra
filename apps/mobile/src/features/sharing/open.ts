import { copiedVariantId } from "@/db/recipe-copies";
import { powersync } from "@/db/system";
import { waitForVariant } from "@/db/variants";
import { supabase } from "@/lib/supabase";

/**
 * The recipe a share link opens (ADR 28): your saved copy, preferring the
 * active household's; else the shared recipe itself when it's already yours;
 * else a copy saved into the active household now.
 */
export async function sharedRecipeToOpen(
  variantId: string,
  activeListId: string,
  listIds: string[],
): Promise<string> {
  const copies = [
    activeListId,
    ...listIds.filter((id) => id !== activeListId),
  ].map((listId) => copiedVariantId(listId, variantId));
  const local = await powersync.getAll<{ id: string }>(
    `SELECT id FROM variants WHERE id IN (${[variantId, ...copies].map(() => "?").join(", ")})`,
    [variantId, ...copies],
  );
  const has = (id: string) => local.some((row) => row.id === id);
  const saved = copies.find(has);
  if (saved) return saved;
  if (has(variantId)) return variantId;

  const { data, error } = await supabase.rpc("copy_variant_to_list", {
    source_variant_id: variantId,
    target_list_id: activeListId,
  });
  if (error?.code === "P0002")
    throw new Error("This recipe is no longer available.");
  if (error || !data || !(await waitForVariant(data)))
    throw new Error("Couldn't save the recipe. Check your connection and try again.");
  return data;
}

import { powersync } from "./system";

/**
 * Removes the recipe and every variant of it for the whole household
 * (ADR 27). The server also drops its recipe chats. A recipe any meal still
 * uses, past or future, stays: the database refuses that delete too.
 */
export async function deleteRecipe(recipeId: string) {
  await powersync.writeTransaction(async (tx) => {
    if (
      await tx.getOptional("SELECT id FROM planned_meals WHERE recipe_id = ? LIMIT 1", [
        recipeId,
      ])
    )
      throw new Error("This recipe is on your meal plan, so it can't be deleted.");
    await tx.execute("DELETE FROM variants WHERE recipe_id = ?", [recipeId]);
    await tx.execute("DELETE FROM recipes WHERE id = ?", [recipeId]);
  });
}

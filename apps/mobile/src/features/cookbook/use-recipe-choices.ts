import { useQuery } from "@powersync/react";
import { useMemo } from "react";

import type { Recipe, Variant } from "@/db/schema";
import { recipeChoices } from "./recipe-choices";

export function useRecipeChoices(search = "") {
  const recipes = useQuery<Recipe>("SELECT * FROM recipes");
  const variants = useQuery<Variant>("SELECT * FROM variants");
  const choices = useMemo(
    () => recipeChoices(recipes.data, variants.data, search),
    [recipes.data, variants.data, search],
  );
  return { choices, isLoading: recipes.isLoading || variants.isLoading };
}

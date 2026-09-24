import { describe, expect, it } from "vitest";

import type { Variant } from "../../db/schema";
import { recipeChoices } from "./recipe-choices";

const recipes = [{ id: "old", created_at: "2026-09-01" }, { id: "new", created_at: "2026-09-20" }];
const variants = [
  { id: "bulgur", recipe_id: "old", name: "Bulgur salad", created_at: "2026-09-01" },
  { id: "bulgur-2", recipe_id: "old", name: "Bulgur with lemon", created_at: "2026-09-02" },
  { id: "orzo", recipe_id: "old", name: "Orzo salad", created_at: "2026-09-23" },
  { id: "soup", recipe_id: "new", name: "Tomato soup", created_at: "2026-09-20" },
] as Variant[];

describe("recipe choices", () => {
  it("shows each recipe once, newest addition first, using its latest variant", () => {
    expect(recipeChoices(recipes, variants).map((c) => c.variant.id)).toEqual(["soup", "orzo"]);
  });

  it("searches all variants but shows only the latest matching variant", () => {
    const choices = recipeChoices(recipes, variants, " BULGUR ");
    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({ variant: { id: "bulgur-2" }, olderVariant: true, variantCount: 3 });
    expect(recipeChoices(recipes, variants, "orzo")[0]?.olderVariant).toBe(false);
    expect(recipeChoices(recipes, variants, "missing")).toEqual([]);
  });

  it("breaks equal timestamps consistently without depending on sync order", () => {
    const tied = variants.map((v) => ({ ...v, created_at: "2026-09-23" }));
    expect(recipeChoices(recipes, tied)).toEqual(recipeChoices(recipes, [...tied].reverse()));
  });
});

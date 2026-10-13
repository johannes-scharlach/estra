import assert from "node:assert/strict";
import { test } from "node:test";

test("recipe adjustment sizes named eaters using their references plus extra food", async () => {
  process.env.SUPABASE_URL ??= "http://localhost:54321";
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ??= "unused";
  process.env.DATABASE_URL ??= "postgres://unused:unused@localhost/unused";
  const { adjustPrompt } = await import("./adjust-planned-meal.js");
  const prompt = adjustPrompt({
    meal: { id: "meal", list_id: "list", recipe_id: "recipe", variant_id: "variant", slot_date: "2026-10-13", meal: "dinner", eater_ids: ["sam", "alex"], extra_portions: 1.5, ingredient_swaps: {} },
    eaters: [
      { id: "sam", name: "Sam", age_group: "Child", diet: "vegetarian", diet_other: "", portion_reference: 0.75 },
      { id: "alex", name: "Alex", age_group: "Adult", diet: "vegetarian", diet_other: "", portion_reference: 1.25 },
    ],
    variant: { name: "Pasta", description: null, locale: "en", total_time: null, recipe_yield: "2 portions", content_markdown: null, recipe_category: null, recipe_cuisine: null, ingredient_lines: [], instructions: [] },
  });
  assert.match(prompt, /Sam .*0.75/);
  assert.match(prompt, /Alex .*1.25/);
  assert.match(prompt, /3.5 regular adult portions/);
  assert.doesNotMatch(prompt, /A child eats less/);
});

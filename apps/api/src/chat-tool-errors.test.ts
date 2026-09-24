import assert from "node:assert/strict";
import { InvalidToolInputError } from "ai";
import { test } from "node:test";

import { AddToCookbookSchema, CookRecipeSchema } from "./recipe-schema.js";
import { chatToolErrorText } from "./chat-tool-errors.js";

test("add-to-cookbook accepts optional household sizing metadata", () => {
  const input = AddToCookbookSchema.safeParse({
    name: "Chickpea stew",
    description: "A simple chickpea stew.",
    locale: "en",
    totalTime: "30 minutes",
    recipeYield: "2 adults",
    recipeIngredient: [
      {
        qty_text: "2 cans",
        item_name: "chickpeas",
        category_id: "spices",
      },
    ],
    recipeInstructions: [
      { name: "Simmer", ingredients: ["chickpeas"], text: "Simmer until tender." },
    ],
    sizedFor: {
      eater_ids: ["00000000-0000-4000-8000-000000000001"],
      extra_portions: 0,
    },
  });

  assert.equal(input.success, true);
  if (input.success) assert.deepEqual(input.data.sizedFor, {
    eater_ids: ["00000000-0000-4000-8000-000000000001"],
    extra_portions: 0,
  });
});

test("missing structured recipe ingredients produce actionable save feedback", () => {
  const parsed = CookRecipeSchema.safeParse({
    name: "Late-Summer Charred Sweet Corn, Zucchini & Feta Skillet",
    locale: "en",
    totalTime: "20 minutes",
    description: "Charred sweet corn and zucchini with feta and basil.",
    recipeYield: "3 portions",
    contentMarkdown: "# Ingredients\\n\\n- sweet corn | 4 ears",
    recipeInstructions: [],
  });
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const error = new InvalidToolInputError({
    toolName: "addToCookbook",
    toolInput: "{}",
    cause: parsed.error,
  });

  assert.equal(
    chatToolErrorText(error),
    "The recipe couldn't be saved because its structured ingredient list is missing. Include a recipeIngredient array with each ingredient's quantity, name, and shopping category.",
  );
});

test("unrelated tool failures do not expose internal error details", () => {
  assert.equal(
    chatToolErrorText(new Error("database password or stack trace")),
    "This action couldn't be completed. Try again.",
  );
});

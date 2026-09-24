import assert from "node:assert/strict";
import { test } from "node:test";
import { convertToModelMessages, safeValidateUIMessages } from "ai";

import {
  MealContextSchema,
  orderRecipeSeed,
  recipeChatPrompt,
  recipeSeed,
} from "./recipe-chat.js";

test("the first user turn initiates the seeded read before the model answers", async () => {
  const recipe = {
    variantId: "variant",
    name: "Sardine bowl",
    recipeInstructions: [{ text: "Bake for 20 minutes." }],
  };
  const seed = recipeSeed("seed", [
    { tool: "readVariant", input: { variantId: "variant" }, output: recipe },
  ]);
  const validation = await safeValidateUIMessages({ messages: [seed] });
  assert.equal(validation.success, true);
  const question = {
    id: "question",
    role: "user" as const,
    parts: [{ type: "text" as const, text: "Could I use tuna?" }],
  };
  const messages = await convertToModelMessages([question, seed]);
  assert.deepEqual(
    messages.map((message) => message.role),
    ["user", "assistant", "tool"],
  );
  assert.match(JSON.stringify(messages[2]), /Bake for 20 minutes/);
  assert.match(JSON.stringify(messages[1]), /readVariant/);
});

test("a chat persisted with the old seed order is repaired for retry", () => {
  const question = {
    role: "user",
    parts: [{ type: "text", text: "Could I use tuna?" }],
  };
  const seed = recipeSeed("seed", [
    { tool: "readVariant", input: {}, output: {} },
  ]);
  const later = { role: "assistant", parts: [{ type: "text", text: "Yes." }] };
  assert.deepEqual(
    orderRecipeSeed([seed, question, later]).map((message) => message.role),
    ["user", "assistant", "assistant"],
  );
  assert.equal(orderRecipeSeed([question, seed, later])[1], seed);
});

test("a written meal seeds the same chat protocol without requiring a recipe", async () => {
  assert.equal(
    MealContextSchema.safeParse({ plannedMealId: "not-an-id" }).success,
    false,
  );
  const seed = recipeSeed("meal-seed", [
    {
      tool: "readPlannedMeal",
      input: { plannedMealId: "meal" },
      output: {
        id: "meal",
        name: "Leftover lasagne with salad",
        variant_id: null,
        eater_ids: ["person"],
        items: [{ name: "Lettuce", status: "purchased" }],
      },
    },
  ]);
  const messages = await convertToModelMessages([
    {
      id: "question",
      role: "user",
      parts: [{ type: "text", text: "Help with shopping" }],
    },
    seed,
  ]);
  assert.deepEqual(
    messages.map((message) => message.role),
    ["user", "assistant", "tool"],
  );
  assert.match(JSON.stringify(messages[2]), /Leftover lasagne/);
  assert.match(JSON.stringify(messages[2]), /purchased/);
  const prompt = recipeChatPrompt({
    list_id: "list",
    recipe_id: null,
    initial_variant_id: null,
    planned_meal_id: "meal",
  });
  assert.match(prompt!, /addMealShoppingItems/);
  assert.match(prompt!, /does not need a recipe/);
});

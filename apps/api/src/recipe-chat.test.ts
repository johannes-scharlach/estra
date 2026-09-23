import assert from "node:assert/strict";
import { test } from "node:test";
import { convertToModelMessages, safeValidateUIMessages } from "ai";

import { orderRecipeSeed, recipeSeed } from "./recipe-chat.js";

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

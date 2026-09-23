import { describe, expect, it } from "vitest";

import { latestRecipeResult, recipeResults } from "./recipe-results";
import type { Parts } from "./stream";

function tool(type: string, state: string, output: unknown): Parts {
  return [{ type, state, toolCallId: "call", input: {}, output }] as Parts;
}

describe("recipe results", () => {
  it("keeps the latest written variant prominent when the agent reads an older variant", () => {
    const latest = { variantId: "tuna", name: "Tuna bowl" };
    expect(
      latestRecipeResult([
        { parts: tool("tool-updateRecipe", "output-available", latest) },
        {
          parts: tool("tool-readVariant", "output-available", {
            variantId: "sardines",
            name: "Sardine bowl",
          }),
        },
        {
          parts: tool("tool-updateRecipe", "input-available", {
            variantId: "unfinished",
            name: "Not saved",
          }),
        },
      ]),
    ).toEqual(latest);
  });

  it("shows receipts from completed writes and tolerates a failed or damaged result", () => {
    const result = {
      variantId: "tuna",
      name: "Tuna bowl",
      plannedMeal: { id: "meal", date: "2026-09-23", meal: "dinner" },
      shopping: {
        added: ["tuna"],
        removed: [],
        updated: [],
        keptBought: ["sardines"],
      },
    };
    expect(
      recipeResults(tool("tool-updateRecipe", "output-available", result)),
    ).toEqual([result]);
    expect(
      recipeResults(
        tool("tool-updateRecipe", "output-available", { error: "failed" }),
      ),
    ).toEqual([]);
  });
});

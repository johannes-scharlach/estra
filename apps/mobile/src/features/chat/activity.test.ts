import { describe, expect, it } from "vitest";

import { activityLabel, activitySteps } from "./activity";
import type { Parts } from "./stream";

function parts(...items: unknown[]): Parts {
  return items as Parts;
}

function tool(
  toolName: string,
  state: string,
  extra: Record<string, unknown> = {},
) {
  return {
    type: `tool-${toolName}`,
    toolCallId: `${toolName}-1`,
    state,
    input: {},
    ...extra,
  };
}

describe("chat activity", () => {
  it("keeps pending actions visible and updates each action when its result arrives", () => {
    const pending = tool("readPlan", "input-available");
    expect(activitySteps(parts(pending), true)).toEqual([
      { id: "readPlan-1", tool: "readPlan", status: "running" },
    ]);

    const completed = tool("readPlan", "output-available", { output: [] });
    const saving = tool("addToCookbook", "input-available");
    expect(activitySteps(parts(completed, saving), true)).toEqual([
      { id: "readPlan-1", tool: "readPlan", status: "completed" },
      { id: "addToCookbook-1", tool: "addToCookbook", status: "running" },
    ]);
  });

  it("does not mark returned errors or interrupted calls as successful", () => {
    const returnedError = tool("planMeal", "output-available", {
      output: { error: "The meal could not be planned." },
    });
    const thrownError = tool("readVariant", "output-error", {
      errorText: "The recipe needs structured ingredients.",
    });
    const interrupted = tool("searchVariants", "input-available");

    expect(activitySteps(parts(returnedError, thrownError, interrupted), false)).toEqual([
      { id: "planMeal-1", tool: "planMeal", status: "failed" },
      {
        id: "readVariant-1",
        tool: "readVariant",
        status: "failed",
        detail: "The recipe needs structured ingredients.",
      },
      { id: "searchVariants-1", tool: "searchVariants", status: "incomplete" },
    ]);
    expect(activityLabel({ id: "planMeal-1", tool: "planMeal", status: "failed" })).toBe(
      "Couldn't update your meal plan",
    );
  });

  it("uses plain language and falls back safely for unknown actions", () => {
    expect(
      activityLabel({ id: "search-1", tool: "searchSavedRecipes", status: "running" }),
    ).toBe("Searching your cookbook");
    expect(activityLabel({ id: "unknown-1", tool: "privateTool", status: "completed" })).toBe(
      "Finished a step",
    );
  });
});

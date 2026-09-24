import type { Parts } from "./stream";

export type ActivityStatus = "running" | "completed" | "failed" | "incomplete";

export type ActivityStep = {
  id: string;
  tool: string;
  status: ActivityStatus;
  detail?: string;
};

const TOOL_LABELS: Record<
  string,
  { running: string; completed: string; failed: string }
> = {
  addMealShoppingItems: {
    running: "Updating your shopping list",
    completed: "Updated your shopping list",
    failed: "Couldn't update your shopping list",
  },
  addToCookbook: {
    running: "Saving to your cookbook",
    completed: "Saved to your cookbook",
    failed: "Couldn't save to your cookbook",
  },
  planMeal: {
    running: "Updating your meal plan",
    completed: "Updated your meal plan",
    failed: "Couldn't update your meal plan",
  },
  readPlan: {
    running: "Checking your meal plan",
    completed: "Checked your meal plan",
    failed: "Couldn't check your meal plan",
  },
  readPlannedMeal: {
    running: "Checking this planned meal",
    completed: "Checked this planned meal",
    failed: "Couldn't check this planned meal",
  },
  readVariant: {
    running: "Reading a saved recipe",
    completed: "Read a saved recipe",
    failed: "Couldn't read the saved recipe",
  },
  searchSavedRecipes: {
    running: "Searching your cookbook",
    completed: "Searched your cookbook",
    failed: "Couldn't search your cookbook",
  },
  searchVariants: {
    running: "Looking through saved recipes",
    completed: "Looked through saved recipes",
    failed: "Couldn't look through saved recipes",
  },
  unplanMeal: {
    running: "Updating your meal plan",
    completed: "Updated your meal plan",
    failed: "Couldn't remove the meal from your plan",
  },
  updateRecipe: {
    running: "Updating the recipe",
    completed: "Updated the recipe",
    failed: "Couldn't update the recipe",
  },
};

type ToolPart = {
  type: string;
  toolCallId?: string;
  state?: string;
  output?: unknown;
  errorText?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOutputError(output: unknown) {
  return isRecord(output) && typeof output.error === "string";
}

/** Project streamed tool parts into an ordered, user-facing activity list. */
export function activitySteps(parts: Parts, streaming: boolean): ActivityStep[] {
  const steps = new Map<string, ActivityStep>();

  parts.forEach((part, index) => {
    if (!part.type.startsWith("tool-")) return;
    const toolPart = part as ToolPart;
    const tool = toolPart.type.slice("tool-".length);
    const id = toolPart.toolCallId ?? `${tool}-${index}`;
    let status: ActivityStatus;

    if (toolPart.state === "output-error" || toolPart.state === "output-denied") {
      status = "failed";
    } else if (toolPart.state === "output-available") {
      status = hasOutputError(toolPart.output) ? "failed" : "completed";
    } else if (
      toolPart.state === "input-streaming" ||
      toolPart.state === "input-available"
    ) {
      status = streaming ? "running" : "incomplete";
    } else {
      return;
    }

    steps.set(id, {
      id,
      tool,
      status,
      ...(status === "failed" && typeof toolPart.errorText === "string"
        ? { detail: toolPart.errorText }
        : {}),
    });
  });

  return [...steps.values()];
}

export function activityLabel(step: ActivityStep) {
  const labels = TOOL_LABELS[step.tool];
  if (!labels) {
    if (step.status === "completed") return "Finished a step";
    if (step.status === "failed") return "Couldn't complete a step";
    if (step.status === "incomplete") return "A step didn't finish";
    return "Working on your request";
  }

  if (step.status === "completed") return labels.completed;
  if (step.status === "failed") return labels.failed;
  if (step.status === "incomplete") return `Didn't finish: ${labels.running.toLowerCase()}`;
  return labels.running;
}

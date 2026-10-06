import type { Parts } from "./stream";

export type ActivityStatus = "running" | "completed";

export type ActivityStep = {
  id: string;
  tool: string;
  status: ActivityStatus;
};

const TOOL_LABELS: Record<
  string,
  { running: string; completed: string }
> = {
  addMealShoppingItems: {
    running: "Updating your shopping list",
    completed: "Updated your shopping list",
  },
  addToCookbook: {
    running: "Saving to your cookbook",
    completed: "Saved to your cookbook",
  },
  planMeal: {
    running: "Updating your meal plan",
    completed: "Updated your meal plan",
  },
  readPlan: {
    running: "Checking your meal plan",
    completed: "Checked your meal plan",
  },
  readPlannedMeal: {
    running: "Checking this planned meal",
    completed: "Checked this planned meal",
  },
  readVariant: {
    running: "Reading a saved recipe",
    completed: "Read a saved recipe",
  },
  searchSavedRecipes: {
    running: "Searching your cookbook",
    completed: "Searched your cookbook",
  },
  searchVariants: {
    running: "Looking through saved recipes",
    completed: "Looked through saved recipes",
  },
  unplanMeal: {
    running: "Updating your meal plan",
    completed: "Updated your meal plan",
  },
  updateRecipe: {
    running: "Updating the recipe",
    completed: "Updated the recipe",
  },
};

type ToolPart = {
  type: string;
  toolCallId?: string;
  state?: string;
  output?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOutputError(output: unknown) {
  return isRecord(output) && typeof output.error === "string";
}

/** Activity describes progress and completed work, not internal failed attempts. */
export function activitySteps(parts: Parts, streaming: boolean): ActivityStep[] {
  const steps = new Map<string, ActivityStep>();

  parts.forEach((part, index) => {
    if (!part.type.startsWith("tool-")) return;
    const toolPart = part as ToolPart;
    const tool = toolPart.type.slice("tool-".length);
    const id = toolPart.toolCallId ?? `${tool}-${index}`;
    let status: ActivityStatus;

    if (toolPart.state === "output-available" && !hasOutputError(toolPart.output)) {
      status = "completed";
    } else if (
      streaming &&
      (toolPart.state === "input-streaming" || toolPart.state === "input-available")
    ) {
      status = "running";
    } else {
      steps.delete(id);
      return;
    }

    steps.set(id, {
      id,
      tool,
      status,
    });
  });

  return [...steps.values()];
}

export function activityLabel(step: ActivityStep) {
  const labels = TOOL_LABELS[step.tool];
  if (!labels) {
    if (step.status === "completed") return "Finished a step";
    return "Working on your request";
  }

  if (step.status === "completed") return labels.completed;
  return labels.running;
}

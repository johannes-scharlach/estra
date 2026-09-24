import { InvalidToolInputError } from "ai";

type ValidationIssue = {
  code?: unknown;
  path?: unknown;
};

function hasMissingIngredientList(cause: unknown): boolean {
  if (typeof cause !== "object" || cause === null || !("issues" in cause))
    return false;

  const issues = (cause as { issues?: unknown }).issues;
  return (
    Array.isArray(issues) &&
    issues.some(
      (issue: ValidationIssue) =>
        issue.code === "invalid_type" &&
        Array.isArray(issue.path) &&
        issue.path.length === 1 &&
        issue.path[0] === "recipeIngredient",
    )
  );
}

/** Safe, actionable text for tool failures sent back in the chat activity. */
export function chatToolErrorText(error: unknown): string {
  if (
    InvalidToolInputError.isInstance(error) &&
    (error.toolName === "addToCookbook" || error.toolName === "updateRecipe")
  ) {
    if (hasMissingIngredientList(error.cause)) {
      return "The recipe couldn't be saved because its structured ingredient list is missing. Include a recipeIngredient array with each ingredient's quantity, name, and shopping category.";
    }

    return "The recipe couldn't be saved because its details don't match the required format. Check the structured ingredients and instructions, then try again.";
  }

  return "This action couldn't be completed. Try again.";
}

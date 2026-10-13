/**
 * The first-run challenge (spec 0011): five imports make the cookbook yours,
 * and each other way into a meal is tried once. Counts come from the
 * recipes and chats you created; the challenge keeps no state of its own.
 */
export type ChallengeCounts = {
  import: number;
  on_hand: number;
  dish: number;
  idea: number;
  recipeChats: number;
};

export type ChallengeGoal = {
  key: "import" | "on_hand" | "dish" | "idea" | "recipe_chat";
  label: string;
  count: number;
  target: number;
  done: boolean;
};

const GOALS: { key: ChallengeGoal["key"]; label: string; target: number }[] = [
  { key: "import", label: "Import 5 recipes you love to cook", target: 5 },
  { key: "on_hand", label: "Cook from what's on hand", target: 1 },
  { key: "dish", label: "Cook a dish you have in mind", target: 1 },
  { key: "idea", label: "Start from an idea", target: 1 },
  { key: "recipe_chat", label: "Start a chat on a recipe", target: 1 },
];

export function challengeGoals(counts: ChallengeCounts): {
  goals: ChallengeGoal[];
  complete: boolean;
} {
  const goals = GOALS.map((goal) => {
    const raw =
      goal.key === "recipe_chat" ? counts.recipeChats : counts[goal.key];
    const count = Math.min(raw, goal.target);
    return { ...goal, count, done: count === goal.target };
  });
  return { goals, complete: goals.every((g) => g.done) };
}

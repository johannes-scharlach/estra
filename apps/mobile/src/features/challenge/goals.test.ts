import { describe, expect, it } from "vitest";
import { challengeGoals } from "./goals";

const none = { import: 0, on_hand: 0, dish: 0, idea: 0, recipeChats: 0 };

describe("first-run challenge", () => {
  it("asks for five imports and one of each other way in", () => {
    const { goals, complete } = challengeGoals({
      ...none,
      import: 4,
      on_hand: 1,
      dish: 1,
      idea: 1,
      recipeChats: 1,
    });
    expect(goals.map((g) => [g.key, g.count, g.target, g.done])).toEqual([
      ["import", 4, 5, false],
      ["on_hand", 1, 1, true],
      ["dish", 1, 1, true],
      ["idea", 1, 1, true],
      ["recipe_chat", 1, 1, true],
    ]);
    expect(complete).toBe(false);
  });

  it("is complete once every goal is met, and never counts past a target", () => {
    const { goals, complete } = challengeGoals({
      import: 9,
      on_hand: 3,
      dish: 1,
      idea: 2,
      recipeChats: 4,
    });
    expect(goals.map((g) => g.count)).toEqual([5, 1, 1, 1, 1]);
    expect(complete).toBe(true);
  });
});

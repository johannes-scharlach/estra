import { describe, expect, it } from "vitest";

import { ingredientsLine } from "./ingredients-line";

const INGREDIENTS = "Pork chops, plums, red onion, balsamic, rosemary";

describe("ingredientsLine", () => {
  it("keeps the whole list when it fits", () => {
    expect(ingredientsLine(INGREDIENTS, INGREDIENTS)).toBe(INGREDIENTS);
  });

  it("cuts at a whole ingredient and counts the rest", () => {
    expect(
      ingredientsLine(INGREDIENTS, "Pork chops, plums, red onion, balsamic, "),
    ).toBe("Pork chops, plums, red onion +2");
  });

  it("always shows the first ingredient", () => {
    expect(ingredientsLine(INGREDIENTS, "Pork")).toBe("Pork chops +4");
  });
});

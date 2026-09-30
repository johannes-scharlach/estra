import { expect, it } from "vitest";

import { decodeForUpload } from "./upload-data";

it("uploads meal choices as a JSON object rather than a string scalar", () => {
  const row = { ingredient_swaps: '{"7":1}', eater_ids: '["person"]', name: "Fish" };
  expect(decodeForUpload("planned_meals", row)).toEqual({
    ingredient_swaps: { 7: 1 }, eater_ids: ["person"], name: "Fish",
  });
  expect(row.ingredient_swaps).toBe('{"7":1}');
  expect(decodeForUpload("planned_meals", { ingredient_swaps: {} })).toEqual({ ingredient_swaps: {} });
  expect(() => decodeForUpload("planned_meals", { ingredient_swaps: "{" })).toThrow(
    expect.objectContaining({ code: "22P02" }),
  );
});

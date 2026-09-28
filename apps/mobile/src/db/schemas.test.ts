import { describe, expect, it } from "vitest";

import { InstructionSchema } from "./schemas";

describe("InstructionSchema", () => {
  it("keeps each step's own share of an ingredient", () => {
    const step = InstructionSchema.parse({
      name: "Glaze",
      ingredients: [
        { qty_text: "75g", item_name: "butter", prep_note: "melted" },
      ],
      text: "Brush over the warm cake.",
    });
    expect(step.ingredients).toEqual([
      { qty_text: "75g", item_name: "butter", prep_note: "melted" },
    ]);
  });

  it("still reads steps saved as plain strings", () => {
    const step = InstructionSchema.parse({
      name: "Simmer",
      ingredients: ["2 cans chickpeas, drained"],
      text: "Simmer until tender.",
    });
    expect(step.ingredients).toEqual(["2 cans chickpeas, drained"]);
  });
});

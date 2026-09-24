import { describe, expect, it } from "vitest";

import { prettyQuantity, splitSpec } from "./spec";

describe("splitSpec", () => {
  it("splits a leading amount from its note", () => {
    expect(splitSpec("3-4 tbsp, leaves torn, chopped")).toEqual({
      amount: "3–4 tbsp",
      note: "leaves torn, chopped",
    });
  });

  it("writes fractions as glyphs", () => {
    expect(splitSpec("1 1/3 bunch").amount).toBe("1⅓ bunch");
    expect(splitSpec("1/2 lemon").amount).toBe("½ lemon");
  });

  it("writes ranges with an en dash", () => {
    expect(splitSpec("2-3 tins, drained").amount).toBe("2–3 tins");
  });

  it("treats a spec without an amount as a note", () => {
    expect(splitSpec("ripe, unwaxed")).toEqual({
      amount: null,
      note: "ripe, unwaxed",
    });
  });
});

describe("prettyQuantity", () => {
  it("writes a spaced range with an en dash", () => {
    expect(prettyQuantity("3 - 5 tins")).toBe("3–5 tins");
  });
});

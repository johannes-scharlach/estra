import { describe, expect, it } from "vitest";

import { isValidPortions, parsePortions } from "./portions";

describe("parsePortions", () => {
  it("accepts decimal points and commas without restricting to quarters", () => {
    expect(parsePortions("2")).toBe(2);
    expect(parsePortions(" 1,23 ")).toBe(1.23);
    expect(parsePortions("0.01")).toBe(0.01);
    expect(parsePortions(".5")).toBe(0.5);
    expect(parsePortions("1.10")).toBe(1.1);
  });

  it("rejects invalid input rather than rounding or partially parsing it", () => {
    for (const text of ["", " ", "0", "-1", "1.234", "1.000", "1e2", "0x10", "Infinity", "NaN", "1,2.3", "2 portions"]) {
      expect(parsePortions(text), text).toBeNull();
    }
    expect(parsePortions("9".repeat(400))).toBeNull();
  });
});

describe("isValidPortions", () => {
  it("accepts positive hundredths despite binary floating-point representation", () => {
    for (const value of [0.01, 0.29, 1.1, 1.23, 2, 21]) {
      expect(isValidPortions(value), String(value)).toBe(true);
    }
  });

  it("rejects nonpositive, nonfinite and excess-decimal values", () => {
    for (const value of [0, -1, NaN, Infinity, -Infinity, 0.001, 1.234, 0.1 + 0.2]) {
      expect(isValidPortions(value), String(value)).toBe(false);
    }
  });
});

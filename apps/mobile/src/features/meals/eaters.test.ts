import { describe, expect, it } from "vitest";

import {
  eatersLabel,
  isValidExtraPortions,
  parseEaterIds,
  parseExtraPortions,
  toEaters,
} from "./eaters";

const people = toEaters(
  [
    { id: "a", name: "Johannes", user_id: "u1" },
    { id: "b", name: "Anna", user_id: null },
    { id: "c", name: "Ben", user_id: null },
  ],
  "u1",
);

describe("eatersLabel", () => {
  it("says everyone when the whole household eats and adds the extra", () => {
    expect(eatersLabel({ people, eaterIds: ["a", "b", "c"], extraPortions: 0 })).toBe("Everyone");
    expect(eatersLabel({ people, eaterIds: ["c", "b", "a"], extraPortions: 1.5 })).toBe(
      "Everyone +1.5 extra",
    );
  });

  it("names a subset with Me for the caller and ignores people no longer in the household", () => {
    expect(eatersLabel({ people, eaterIds: ["a", "b", "gone"], extraPortions: 2 })).toBe(
      "Me, Anna +2 extra",
    );
  });

  it("does not call a household with nobody left everyone", () => {
    expect(eatersLabel({ people: [], eaterIds: [], extraPortions: 0 })).toBe("Nobody");
    expect(eatersLabel({ people, eaterIds: [], extraPortions: 0.5 })).toBe("Nobody +0.5 extra");
  });
});

describe("parseEaterIds", () => {
  it("reads the JSON text SQLite holds and treats anything else as nobody", () => {
    expect(parseEaterIds('["a","b"]')).toEqual(["a", "b"]);
    expect(parseEaterIds(["a", 1, null])).toEqual(["a"]);
    for (const raw of [null, undefined, "", "{", '{"a":1}', 3]) {
      expect(parseEaterIds(raw), String(raw)).toEqual([]);
    }
  });
});

describe("parseExtraPortions", () => {
  it("accepts zero, decimal points and commas", () => {
    expect(parseExtraPortions("0")).toBe(0);
    expect(parseExtraPortions(" 1,25 ")).toBe(1.25);
    expect(parseExtraPortions(".5")).toBe(0.5);
  });

  it("rejects invalid input rather than rounding or partially parsing it", () => {
    for (const text of ["", "-1", "1.234", "1e2", "Infinity", "NaN", "2 portions"]) {
      expect(parseExtraPortions(text), text).toBeNull();
    }
  });
});

describe("isValidExtraPortions", () => {
  it("accepts hundredths despite binary floating-point representation", () => {
    for (const value of [0, 0.29, 1.1, 2.5, 21]) {
      expect(isValidExtraPortions(value), String(value)).toBe(true);
    }
  });

  it("rejects negative, nonfinite and excess-decimal values", () => {
    for (const value of [-1, NaN, Infinity, 0.001, 0.1 + 0.2]) {
      expect(isValidExtraPortions(value), String(value)).toBe(false);
    }
  });
});

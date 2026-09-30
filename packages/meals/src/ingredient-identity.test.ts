import { describe, expect, it } from "vitest";
import { assignIngredientIds, mealIngredients, rebaseMealSwaps, resolveMealItem } from "./index";

describe("meal ingredient identity", () => {
  const base = [
    { id: 1, item_name: "Sardines", qty_text: "3 tins", swaps: [{ item_name: "Tuna", qty_text: "2 tins" }] },
    { id: 2, item_name: "Olives", qty_text: "60g" },
  ];
  it("preserves identity through substitutions and reordering, without recycling removed ids", () => {
    const revised = assignIngredientIds([
      { item_name: "Capers", qty_text: "20g" },
      { id: 1, item_name: "Tuna", qty_text: "4 tins" },
    ], 3, base);
    expect(revised.lines.map((line) => line.id)).toEqual([3, 1]);
    expect(revised.nextId).toBe(4);
    expect(assignIngredientIds([{ item_name: "Lemon", qty_text: "1" }], revised.nextId, revised.lines).lines[0]!.id).toBe(4);
    expect(() => assignIngredientIds([base[0]!, base[0]!], 3, base)).toThrow();
    expect(() => assignIngredientIds([{ ...base[0]!, id: 99 }], 3, base)).toThrow();
  });
  it("resolves choices without shopping and leaves purchase snapshots intact", () => {
    const swaps = { 1: 1 };
    expect(mealIngredients(base, swaps)[0]!.chosen.item_name).toBe("Tuna");
    const item = { ingredient_id: 1, name: "Sardines", spec: "3 tins", category_id: null, status: "active" };
    expect(resolveMealItem(item, base, swaps)).toMatchObject({ name: "Tuna", spec: "2 tins" });
    expect(resolveMealItem({ ...item, status: "purchased" }, base, swaps)).toMatchObject({ name: "Sardines", spec: "3 tins" });
    expect(resolveMealItem({ ...item, status: "purchased" }, [], {})).toMatchObject({ name: "Sardines", spec: "3 tins" });
  });
  it("clears only incorporated choices and preserves remaining choices when alternatives move", () => {
    expect(rebaseMealSwaps(base, { 1: 1 }, [
      { id: 1, item_name: "Tuna", qty_text: "4 tins" },
    ])).toEqual({});
    expect(rebaseMealSwaps(base, { 1: 1 }, [
      { ...base[0]!, swaps: [{ item_name: "Salmon", qty_text: "200g" }, ...base[0]!.swaps!] },
    ])).toEqual({ 1: 2 });
    expect(rebaseMealSwaps(base, { 1: 1 }, [])).toEqual({});
    expect(() => rebaseMealSwaps(base, { 1: 1 }, [
      { id: 1, item_name: "Sardines", qty_text: "3 tins" },
    ])).toThrow("choice of Tuna");
  });
});

import { describe, expect, it } from "vitest";

import { listActivityText } from "./list-activity-text";

// Twin of supabase/functions/_shared/list-activity-text.test.ts.

const added = (...item_names: string[]) =>
  listActivityText({ kind: "items_added", actor_name: "Anna", item_names });
const bought = (...item_names: string[]) =>
  listActivityText({ kind: "items_bought", actor_name: "Anna", item_names });

describe("list activity text", () => {
  it("added names up to three items, then counts the rest", () => {
    expect(added("Milk")).toEqual({ title: "Added to the List", body: "Milk · Anna" });
    expect(added("Milk", "eggs", "lemons").body).toBe("Milk, eggs, lemons · Anna");
    expect(added("Milk", "eggs", "lemons", "oats", "rice").body).toBe(
      "Milk, eggs, lemons +2 · Anna",
    );
  });

  it("bought counts the items", () => {
    expect(bought("Milk")).toEqual({ title: "Shopping done", body: "1 item bought · Anna" });
    expect(bought("Milk", "eggs").body).toBe("2 items bought · Anna");
  });
});

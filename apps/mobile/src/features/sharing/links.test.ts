import { describe, expect, it } from "vitest";
import { sharedRecipeUrl, sharedVariantId } from "./links";

describe("recipe share handoff", () => {
  const id = "f2700000-0000-4000-8000-000000000002";
  it("sends a web link whose page opens the same recipe in the app", () => {
    expect(sharedRecipeUrl("https://magpie-api.fly.dev/", id)).toBe(
      `https://magpie-api.fly.dev/r/${id}`,
    );
    expect(sharedVariantId(`magpie://shared/${id}`)).toBe(id);
    expect(sharedVariantId(`exp://localhost:8081/--/shared/${id}`)).toBe(id);
  });
  it("ignores other links and malformed ids", () => {
    expect(sharedVariantId(`magpie://variant/${id}`)).toBeNull();
    expect(sharedVariantId("magpie://shared/not-an-id")).toBeNull();
    expect(sharedVariantId("not a URL")).toBeNull();
    expect(sharedVariantId(null)).toBeNull();
  });
});

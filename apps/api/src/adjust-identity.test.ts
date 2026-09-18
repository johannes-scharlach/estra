import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveVariantIdForAdjust } from "./adjust-identity.js";

test("a retry of the same adjustment derives the same variant", () => {
  assert.equal(
    deriveVariantIdForAdjust("user", "op", "meal"),
    deriveVariantIdForAdjust("user", "op", "meal"),
  );
});

test("another caller, operation, or meal cannot reuse the saved result", () => {
  const id = deriveVariantIdForAdjust("user", "op", "meal");
  assert.notEqual(deriveVariantIdForAdjust("other", "op", "meal"), id);
  assert.notEqual(deriveVariantIdForAdjust("user", "op-2", "meal"), id);
  assert.notEqual(deriveVariantIdForAdjust("user", "op", "meal-2"), id);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveVariantIdForImport } from "./import-identity.js";

const request = {
  operationId: "operation",
  url: "https://example.com/recipe",
  locale: "en",
  plan: { listId: "list", date: "2026-09-08", slot: "dinner" },
} as const;

test("retries derive the same identity regardless of object key order", () => {
  assert.equal(
    deriveVariantIdForImport("user", {
      ...request,
      plan: { slot: "dinner", date: "2026-09-08", listId: "list" },
    }),
    deriveVariantIdForImport("user", request),
  );
});

test("another caller, operation, or destination cannot reuse the saved result", () => {
  const id = deriveVariantIdForImport("user", request);
  assert.notEqual(deriveVariantIdForImport("another-user", request), id);
  assert.notEqual(deriveVariantIdForImport("user", { ...request, operationId: "next-operation" }), id);
  assert.notEqual(deriveVariantIdForImport("user", {
    ...request, plan: { ...request.plan, slot: "lunch" },
  }), id);
  assert.notEqual(deriveVariantIdForImport("user", { ...request, plan: undefined }), id);
});

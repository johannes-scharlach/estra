import assert from "node:assert/strict";
import { test } from "node:test";
import { variantUrl } from "./variants.js";

test("saved recipes link to the Magpie variant screen", () => {
  const id = "50e8d194-4818-5c8b-9f60-c5a4d6c120c8";
  assert.equal(variantUrl(id), `magpie://variant/${id}`);
});

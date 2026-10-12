import assert from "node:assert/strict";
import { test } from "node:test";

import { magpieUuidV5 } from "./magpie-uuid.js";

test("persisted IDs retain their established namespace", () => {
  assert.equal(
    magpieUuidV5("list:2026-09-08:dinner"),
    "50e8d194-4818-5c8b-9f60-c5a4d6c120c8",
  );
});

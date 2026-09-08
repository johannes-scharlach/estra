import assert from "node:assert/strict";
import { test } from "node:test";

import { estraUuidV5 } from "./estra-uuid.js";

test("persisted IDs retain their established namespace", () => {
  assert.equal(
    estraUuidV5("list:2026-09-08:dinner"),
    "50e8d194-4818-5c8b-9f60-c5a4d6c120c8",
  );
});

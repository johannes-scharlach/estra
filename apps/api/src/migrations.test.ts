import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { test } from "node:test";

test("Supabase migration versions are unique across the repo", async () => {
  const files = await readdir(new URL("../../../supabase/migrations/", import.meta.url));
  const versions = new Map<string, string>();
  for (const file of files.filter((name) => name.endsWith(".sql"))) {
    const version = file.match(/^(\d{14})_/)?.[1];
    assert.ok(version, `Migration needs a 14-digit version: ${file}`);
    assert.ok(!versions.has(version), `Duplicate migration version: ${versions.get(version)} and ${file}`);
    versions.set(version, file);
  }
});

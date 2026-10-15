import assert from "node:assert/strict";
import { test } from "node:test";
import { sharedRecipePage } from "./routes/shared-recipes.js";

const id = "f2700000-0000-4000-8000-000000000002";
const cookies = {
  name: "Brown butter <cookies>",
  description: "Chewy, salty, gone by evening.",
  ingredient_lines: [
    { qty_text: "200g", item_name: "butter" },
    { qty_text: null, item_name: "flaky salt" },
  ],
};

test("a shared recipe page shows enough to want it, and opens it in the app", async () => {
  const page = sharedRecipePage(async (asked) => (asked === id ? cookies : null));
  const response = await page.request(`/${id}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const body = await response.text();
  assert.ok(body.includes("Brown butter &lt;cookies&gt;"));
  assert.ok(body.includes("Chewy, salty, gone by evening."));
  assert.ok(body.includes("200g butter"));
  assert.ok(body.includes("flaky salt"));
  assert.ok(body.includes(`magpie://shared/${id}`));
});

test("a deleted recipe says so; a malformed link never reaches the database", async () => {
  let reads = 0;
  const page = sharedRecipePage(async () => {
    reads += 1;
    return null;
  });
  const gone = await page.request(`/${id}`);
  assert.equal(gone.status, 404);
  assert.match(await gone.text(), /no longer available/);

  const malformed = await page.request("/javascript%3Aalert(1)");
  assert.equal(malformed.status, 404);
  assert.ok(!(await malformed.text()).includes("javascript:"));
  assert.equal(reads, 1);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { invitations } from "./routes/invitations.js";

test("public invite landing opens the app without revealing household data", async () => {
  const code = "0123456789abcdef0123456789abcdef";
  const response = await invitations.request(`/${code}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const body = await response.text();
  assert.ok(body.includes(`estra://join?code=${code}`));
  assert.ok(body.includes("Install Estra, then tap this invitation"));
});

test("malformed invite links cannot inject a deep-link target or markup", async () => {
  const response = await invitations.request("/javascript%3Aalert(1)");
  assert.equal(response.status, 404);
  assert.ok(!(await response.text()).includes("javascript:"));
});

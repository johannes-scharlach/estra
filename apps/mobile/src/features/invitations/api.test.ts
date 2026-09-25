import { createClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { acceptInvitation, householdInviteCode } from "./api";

// Keep the real Supabase Functions client and its HTTP error handling. Only
// replace the native auth store/client and the network boundary.
vi.mock("@/lib/supabase", () => ({
  supabase: createClient("http://localhost:55321", "test-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (...args) => globalThis.fetch(...args) },
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("reports gateway failures even when the Edge Function never runs", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ message: "An unexpected error occurred" }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  )));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});

  await expect(householdInviteCode("bb000000-0000-4000-8000-000000000001"))
    .rejects.toMatchObject({
      status: 500,
      message: "An unexpected error occurred (HTTP 500)",
    });
  expect(log).toHaveBeenCalledWith("Household invitation request failed", {
    function: "join-list", action: "share", status: 500,
    message: "An unexpected error occurred (HTTP 500)",
  });
});

it("keeps actionable claim conflicts and logs no invitation secret or name", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ error: "That person is no longer available. Please choose again." }),
    { status: 409, headers: { "Content-Type": "application/json" } },
  )));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const code = "0123456789abcdef0123456789abcdef";

  await expect(acceptInvitation(code, { name: "Private name" })).rejects.toMatchObject({
    status: 409,
    message: "That person is no longer available. Please choose again.",
  });
  expect(log).toHaveBeenCalledOnce();
  expect(JSON.stringify(log.mock.calls)).not.toContain(code);
  expect(JSON.stringify(log.mock.calls)).not.toContain("Private name");
});

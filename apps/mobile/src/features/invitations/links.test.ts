import { describe, expect, it } from "vitest";
import { invitationCode, invitationUrl } from "./links";

describe("invitation handoff", () => {
  const code = "0123456789abcdef0123456789abcdef";
  it("keeps the same code through the shared link and native sign-in entry", () => {
    const url = invitationUrl("https://magpie-api.fly.dev/", code);
    expect(invitationCode(url)).toBe(code);
    expect(invitationCode(`magpie://join?code=${code}`)).toBe(code);
    expect(invitationCode(`exp://localhost:8081/--/join?code=${code}`)).toBe(
      code,
    );
  });
  it("does not interrupt the app for unrelated links; malformed invites remain dismissible", () => {
    expect(invitationCode("magpie://variant/123")).toBeNull();
    expect(invitationCode(null)).toBeNull();
    expect(invitationCode("not a URL")).toBeNull();
    expect(invitationCode("magpie://join")).toBe("invalid");
  });
});

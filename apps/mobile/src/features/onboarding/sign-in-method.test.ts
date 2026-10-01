import { describe, expect, it } from "vitest";
import { signInMethod } from "./sign-in-method";

describe("returning-user sign-in", () => {
  it("uses a password for the review address, ignoring case and surrounding whitespace", () => {
    expect(signInMethod("johannes.scharlach+apple@gmail.com")).toBe("password");
    expect(signInMethod("  Johannes.Scharlach+Apple@Gmail.com  ")).toBe(
      "password",
    );
  });
  it("keeps other addresses on OTP, including other aliases of the same Gmail inbox", () => {
    expect(signInMethod("sam@example.com")).toBe("otp");
    expect(signInMethod("johannes.scharlach@gmail.com")).toBe("otp");
    expect(signInMethod("johannes.scharlach+test@gmail.com")).toBe("otp");
    expect(signInMethod("johannesscharlach+apple@gmail.com")).toBe("otp");
  });
});

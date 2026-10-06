import { describe, expect, it } from "vitest";

import { pushRegistrationAction } from "./push-registration";

describe("push registration sync", () => {
  it("registers only while the OS grants permission, and unregisters otherwise", () => {
    expect(pushRegistrationAction("enabled")).toBe("register");
    expect(pushRegistrationAction("disabled")).toBe("unregister");
    // A device revoked in system settings may still be re-askable (Android
    // reports not-asked), but until granted again it cannot show a push.
    expect(pushRegistrationAction("not-asked")).toBe("unregister");
  });
});

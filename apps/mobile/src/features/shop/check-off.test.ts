import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CheckOff } from "./check-off";

function setup(commit = vi.fn(async () => {})) {
  const change = vi.fn();
  const error = vi.fn();
  const checkOff = new CheckOff(380, { change, error });
  return {
    checkOff,
    tap: (onTarget = true) => {
      checkOff.press(commit);
      checkOff.release(onTarget);
    },
    commit,
    error,
    pending: () => change.mock.lastCall?.[0] ?? false,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("check-off", () => {
  it("stays checked after the write until the data shows the row purchased", async () => {
    const { checkOff, tap, commit, pending } = setup();
    tap();
    expect(pending()).toBe(true);
    await vi.advanceTimersByTimeAsync(380);
    expect(commit).toHaveBeenCalledOnce();
    expect(pending()).toBe(true);
    checkOff.settle(true);
    expect(pending()).toBe(true);
    checkOff.settle(false);
    expect(pending()).toBe(false);
  });

  it("a second press inside the window flips it back", async () => {
    const { tap, commit, pending } = setup();
    tap();
    tap();
    await vi.advanceTimersByTimeAsync(380);
    expect(commit).not.toHaveBeenCalled();
    expect(pending()).toBe(false);
  });

  it("a press that ends off target flips it back", async () => {
    const { tap, commit, pending } = setup();
    tap(false);
    await vi.advanceTimersByTimeAsync(380);
    expect(commit).not.toHaveBeenCalled();
    expect(pending()).toBe(false);
  });

  it("a failed write unchecks and reports", async () => {
    const { tap, error, pending } = setup(
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    tap();
    await vi.advanceTimersByTimeAsync(380);
    expect(error).toHaveBeenCalled();
    expect(pending()).toBe(false);
  });
});

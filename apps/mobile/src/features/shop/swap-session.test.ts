import { describe, expect, it, vi } from "vitest";

import { orderedAlternatives, type Alternative } from "./alternatives";
import { SwapSession } from "./swap-session";

const options: Alternative[] = ["Sour cream", "Yogurt", "Creme fraiche"].map(
  (name) => ({ name, qtyText: "100g", prepNote: null, categoryId: null }),
);

function setup(save = vi.fn(async (_option: Alternative) => {})) {
  const callbacks = {
    save,
    change: vi.fn(),
    release: vi.fn(),
    error: vi.fn(),
  };
  return { session: new SwapSession(options, callbacks), ...callbacks };
}

async function flush(times = 10) {
  for (let i = 0; i < times; i++)
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("swap exploration", () => {
  it("keeps choices in place until a new browsing session starts", () => {
    const strip = orderedAlternatives("Yogurt", options);
    expect(strip.map((option) => option.name)).toEqual([
      "Yogurt", "Creme fraiche", "Sour cream",
    ]);
    expect(strip[strip.indexOf(options[0]!) + 1]).toBeUndefined();
    expect(orderedAlternatives("Sour cream", strip)).toEqual(options);
  });

  it("saves swaps in order and never releases on its own", async () => {
    const { session, save, release } = setup();
    session.select(options[1]!);
    session.select(options[2]!);
    await flush();
    expect(save.mock.calls.map(([option]) => option)).toEqual([
      options[1],
      options[2],
    ]);
    expect(release).not.toHaveBeenCalled();
  });

  it("checks the incoming ingredient after all requested swaps have saved", async () => {
    const first = Promise.withResolvers<void>();
    const saved: string[] = [];
    const { session, release } = setup(vi.fn(async (option) => {
      if (option === options[1]) await first.promise;
      saved.push(option.name);
    }));
    session.select(options[1]!);
    session.select(options[2]!);
    const purchase = vi.fn(async () => {
      expect(saved).toEqual(["Yogurt", "Creme fraiche"]);
    });
    const checking = session.check(purchase);
    await flush();
    expect(purchase).not.toHaveBeenCalled();
    first.resolve();
    await checking;
    expect(purchase).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it("does not check the old ingredient or execute queued swaps after a failure", async () => {
    const { session, save, error } = setup(vi.fn(async () => {
      throw new Error("write failed");
    }));
    session.select(options[1]!);
    session.select(options[2]!);
    const purchase = vi.fn(async () => {});
    await session.check(purchase);
    expect(purchase).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
    expect(session.selected).toEqual(options[0]);
    session.dispose();
  });
});

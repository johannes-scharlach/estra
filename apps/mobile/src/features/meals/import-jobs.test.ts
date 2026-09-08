import { describe, expect, it, vi } from "vitest";

import { ImportJobs, type ImportResult } from "./import-jobs";
import { ImportFailure } from "./import-failure";

const target = { listId: "list", date: "2026-09-08", slot: "dinner" } as const;
const result = { recipeId: "recipe", variantId: "variant" };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup() {
  const dependencies = {
    createOperationId: vi.fn(() => "operation"),
    importRecipe: vi.fn(async () => result),
    waitForMeal: vi.fn(async () => {}),
    onCompleted: vi.fn(),
  };
  return { jobs: new ImportJobs(dependencies), ...dependencies };
}

describe("ImportJobs", () => {
  it("publishes progress immediately, prevents duplicate work, and completes only after sync", async () => {
    const { jobs, importRecipe, waitForMeal, onCompleted } = setup();
    const imported = deferred<ImportResult>();
    const synced = deferred<void>();
    importRecipe.mockReturnValue(imported.promise);
    waitForMeal.mockReturnValue(synced.promise);
    const states: string[] = [];
    jobs.subscribe(() =>
      states.push(jobs.getForSlot(target)?.status ?? "complete"),
    );
    const work = jobs.start(target, "https://recipe.example");
    await jobs.start(target, "https://recipe.example");
    jobs.dismiss(target);
    expect(importRecipe).toHaveBeenCalledTimes(1);
    expect(states).toEqual(["importing"]);
    imported.resolve(result);
    await Promise.resolve();
    expect(states).toEqual(["importing", "syncing"]);
    expect(onCompleted).not.toHaveBeenCalled();
    synced.resolve();
    await work;
    expect(states).toEqual(["importing", "syncing", "complete"]);
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("keeps operation identity when retrying an uncertain import", async () => {
    const { jobs, importRecipe, createOperationId } = setup();
    importRecipe.mockRejectedValueOnce(
      new ImportFailure("NETWORK_ERROR", "Retry", true),
    );
    await jobs.start(target, "https://recipe.example");
    await jobs.retry(target);
    expect(importRecipe.mock.calls[0]).toEqual(importRecipe.mock.calls[1]);
    expect(createOperationId).toHaveBeenCalledOnce();
    expect(jobs.getForSlot(target)).toBeUndefined();
  });

  it("retries only sync once the import was saved", async () => {
    const { jobs, importRecipe, waitForMeal } = setup();
    waitForMeal.mockRejectedValueOnce(
      new ImportFailure("SYNC_TIMEOUT", "Retry sync", true),
    );
    await jobs.start(target, "https://recipe.example");
    expect(jobs.getForSlot(target)).toMatchObject({ status: "error", result });
    await jobs.retry(target);
    expect(importRecipe).toHaveBeenCalledOnce();
    expect(waitForMeal).toHaveBeenCalledTimes(2);
  });

  it("requires dismissal of a non-retryable error and isolates other slots", async () => {
    const { jobs, importRecipe } = setup();
    importRecipe.mockRejectedValueOnce(
      new ImportFailure("MEAL_SLOT_OCCUPIED", "Choose another slot", false),
    );
    await jobs.start(target, "https://recipe.example");
    await jobs.retry(target);
    await jobs.start(target, "https://another.example");
    expect(importRecipe).toHaveBeenCalledOnce();
    await jobs.start({ ...target, slot: "lunch" }, "https://recipe.example");
    expect(jobs.getForSlot(target)?.status).toBe("error");
    jobs.dismiss(target);
    expect(jobs.getSnapshot()).toEqual([]);
  });
});

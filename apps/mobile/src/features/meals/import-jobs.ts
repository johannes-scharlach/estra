import type { MealSlot } from "./slots";
import { importFailure, type ImportFailure } from "./import-failure";

export type ImportTarget = Readonly<{
  listId: string;
  date: string;
  slot: MealSlot;
}>;
export type ImportRequest = Readonly<{
  operationId: string;
  url: string;
  plan: ImportTarget;
}>;
export type ImportResult = Readonly<{ recipeId: string; variantId: string }>;
export type ImportJob = Readonly<
  {
    request: ImportRequest;
  } & (
    | { status: "importing" }
    | { status: "syncing"; result: ImportResult }
    | { status: "error"; error: ImportFailure; result?: ImportResult }
  )
>;

type Dependencies = {
  createOperationId: () => string;
  importRecipe: (request: ImportRequest) => Promise<ImportResult>;
  waitForMeal: (target: ImportTarget, result: ImportResult) => Promise<void>;
  onCompleted: (target: ImportTarget) => void;
};

/** Owns the lifecycle. HTTP, local sync, and native feedback are injected. */
export class ImportJobs {
  private jobs: readonly ImportJob[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(private readonly dependencies: Dependencies) {}

  readonly getSnapshot = (): readonly ImportJob[] => this.jobs;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getForSlot(target: ImportTarget): ImportJob | undefined {
    return this.jobs.find(
      ({ request: { plan } }) =>
        plan.listId === target.listId &&
        plan.date === target.date &&
        plan.slot === target.slot,
    );
  }

  async start(target: ImportTarget, url: string): Promise<void> {
    // An existing failure must be retried or dismissed explicitly.
    if (this.getForSlot(target)) return;
    const request = {
      operationId: this.dependencies.createOperationId(),
      url,
      plan: { ...target },
    };
    await this.run(request);
  }

  async retry(target: ImportTarget): Promise<void> {
    const job = this.getForSlot(target);
    if (job?.status !== "error" || !job.error.retryable) return;
    await this.run(job.request, job.result);
  }

  dismiss(target: ImportTarget): void {
    const job = this.getForSlot(target);
    if (job?.status === "error") this.remove(job.request);
  }

  private async run(
    request: ImportRequest,
    saved?: ImportResult,
  ): Promise<void> {
    let result = saved;
    try {
      if (!result) {
        this.publish({ request, status: "importing" });
        result = await this.dependencies.importRecipe(request);
      }
      this.publish({ request, status: "syncing", result });
      await this.dependencies.waitForMeal(request.plan, result);
    } catch (error) {
      this.publish({
        request,
        status: "error",
        error: importFailure(error),
        result,
      });
      return;
    }
    this.remove(request);
    this.dependencies.onCompleted(request.plan);
  }

  private publish(job: ImportJob): void {
    this.jobs = [
      ...this.jobs.filter((existing) => existing.request !== job.request),
      job,
    ];
    this.listeners.forEach((listener) => listener());
  }

  private remove(request: ImportRequest): void {
    this.jobs = this.jobs.filter((job) => job.request !== request);
    this.listeners.forEach((listener) => listener());
  }
}

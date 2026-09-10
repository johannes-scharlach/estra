import type { Alternative } from "./alternatives";

// One row's exploration. Persistence is immediate and ordered; placement is
// held by the screen until it loses focus, so a swapped row only re-sorts on
// revisit. Checking out releases a row early (into Checked).
export class SwapSession {
  selected: Alternative;
  private confirmed: Alternative;
  private write: Promise<boolean> = Promise.resolve(true);
  private generation = 0;
  private checking = false;
  private disposed = false;

  constructor(
    readonly options: Alternative[],
    private readonly callbacks: {
      save: (option: Alternative) => Promise<void>;
      change: (option: Alternative) => void;
      release: () => void;
      error: () => void;
    },
  ) {
    this.selected = this.confirmed = options[0]!;
  }

  select(option: Alternative) {
    if (this.disposed || this.checking || !this.options.includes(option)) return;
    this.selected = option;
    this.callbacks.change(option);
    const generation = this.generation;
    this.write = this.write.then(async () => {
      try {
        if (generation !== this.generation) return false;
        await this.callbacks.save(option);
        this.confirmed = option;
        return true;
      } catch {
        this.generation++;
        this.selected = this.confirmed;
        if (!this.disposed) {
          this.callbacks.change(this.confirmed);
          this.callbacks.error();
        }
        return false;
      }
    });
  }

  prepareCheck() {
    this.checking = true;
  }

  cancelCheck() {
    this.checking = false;
  }

  async check(purchase: () => Promise<void>) {
    this.prepareCheck();
    // Capture all swaps requested before the checkbox tap, including queued ones.
    const saved = await this.write;
    if (!saved) {
      this.cancelCheck();
      return;
    }
    try {
      await purchase();
      if (!this.disposed) this.callbacks.release();
      this.dispose();
    } catch (error) {
      this.cancelCheck();
      throw error;
    }
  }

  dispose() {
    this.disposed = true;
  }
}

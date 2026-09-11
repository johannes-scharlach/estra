// One row's check-off. Finger down flips the checkbox at once and starts a
// short undo window; a second press inside the window flips it back, and so
// does a press that ends off target. The checkmark then stays until the data
// shows the row purchased, so it never blinks between the write resolving and
// the query catching up.
export class CheckOff {
  private pending = false;
  private pressed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private commit: (() => Promise<void>) | null = null;

  constructor(
    private readonly delayMs: number,
    private readonly callbacks: {
      change: (pending: boolean) => void;
      error: () => void;
    },
  ) {}

  press(commit: () => Promise<void>) {
    this.commit = commit;
    this.pressed = true;
    this.toggle();
  }

  release(onTarget: boolean) {
    if (!this.pressed) return;
    this.pressed = false;
    if (!onTarget) this.toggle();
  }

  // The data caught up: the row is purchased, or gone.
  settle(active: boolean) {
    if (active || !this.pending) return;
    this.clearTimer();
    this.set(false);
  }

  dispose() {
    this.clearTimer();
  }

  private toggle() {
    if (this.timer) {
      this.clearTimer();
      this.set(false);
      return;
    }
    if (this.pending) return;
    this.set(true);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.commit?.().catch(() => {
        this.set(false);
        this.callbacks.error();
      });
    }, this.delayMs);
  }

  private set(pending: boolean) {
    if (this.pending === pending) return;
    this.pending = pending;
    this.callbacks.change(pending);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

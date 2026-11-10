/**
 * The module's buttons as presses: a tap when let go quickly, a hold once kept down
 * HOLD_MS (fired while still held, so the rider feels it take). The module sends only
 * debounced edges; the timing is here, so it can change without reflashing the board.
 */

/** In the order they're wired (module/README.md): a five-way pad. */
export const BUTTONS = ['up', 'down', 'left', 'right', 'ok'] as const;
export type ButtonName = (typeof BUTTONS)[number];

export interface Press {
  button: ButtonName;
  hold: boolean;
}

export const HOLD_MS = 600;

export class ButtonReader {
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private held = new Set<number>();
  private readonly onPress: (press: Press) => void;

  constructor(onPress: (press: Press) => void) {
    this.onPress = onPress;
  }

  /** A debounced edge from the module. */
  edge(index: number, down: boolean): void {
    const button = BUTTONS[index];
    if (!button) return;
    if (down) {
      this.cancel(index);
      this.held.delete(index);
      this.timers.set(
        index,
        setTimeout(() => {
          this.timers.delete(index);
          this.held.add(index);
          this.onPress({ button, hold: true });
        }, HOLD_MS),
      );
      return;
    }
    // Up: a tap, unless it was held (that press is done).
    const pending = this.timers.has(index);
    this.cancel(index);
    if (pending && !this.held.has(index)) this.onPress({ button, hold: false });
    this.held.delete(index);
  }

  /** Unplugged mid-press: nothing fires late. */
  reset(): void {
    for (const index of [...this.timers.keys()]) this.cancel(index);
    this.held.clear();
  }

  private cancel(index: number): void {
    const timer = this.timers.get(index);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(index);
  }
}

/**
 * A pretend module, for working on RIDECORE in a browser (link.ts, ?module in the
 * address, development builds only): a bike weaving left and right at 30–60 km/h, its
 * IMU and wheel saying so as the real board would, and the keyboard's arrows and Enter
 * as the five buttons.
 */
import { HI_LINE } from './protocol';

const G = 9.81;
const HZ = 50;
const WHEEL_M = 1.95;
const KEYS: Record<string, number> = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3, Enter: 4 };

export function simulateModule(emit: (lines: string[]) => void): { send(line: string): void } {
  const started = performance.now();
  const hello = () => JSON.stringify({ t: 'hello', v: 1, fw: 'sim', btn: 5, whl: true, imu: 'Simulated IMU', hz: HZ });
  let pulses = 0;
  let travelled = 0;
  let lastMs = 0;
  let lastPulseMs = 0;
  let period = 0;

  emit([hello()]);

  // Every 100 ms: five IMU samples and the wheel, as the board batches them over USB.
  window.setInterval(() => {
    const lines: string[] = [];
    const now = performance.now() - started;
    for (let ms = lastMs + 1000 / HZ; ms <= now; ms += 1000 / HZ) {
      const t = ms / 1000;
      const speed = (45 + 15 * Math.sin(t / 9)) / 3.6;
      // A weave: leaning ±30° over ten seconds, the turn rate a steady turn would have.
      const phi = (30 * Math.PI) / 180 * Math.sin((2 * Math.PI * t) / 10);
      const phiRate = (30 * Math.PI) / 180 * ((2 * Math.PI) / 10) * Math.cos((2 * Math.PI * t) / 10);
      const yaw = (-G * Math.tan(phi)) / speed;
      const dps = (rad: number) => Math.round((rad * 180 * 100) / Math.PI);
      lines.push(
        JSON.stringify({
          t: 'imu',
          ms: Math.round(ms),
          a: [0, 0, Math.round(1000 / Math.cos(phi))],
          g: [dps(phiRate), dps(yaw * Math.sin(phi)), dps(yaw * Math.cos(phi))],
        }),
      );
      travelled += speed / HZ;
      while (travelled >= WHEEL_M) {
        travelled -= WHEEL_M;
        pulses += 1;
        period = (ms - lastPulseMs) * 1000;
        lastPulseMs = ms;
      }
      lastMs = ms;
    }
    lines.push(JSON.stringify({ t: 'whl', n: pulses, p: Math.round(period), age: Math.round(now - lastPulseMs) }));
    emit(lines);
  }, 100);

  window.setInterval(() => emit([JSON.stringify({ t: 'hb', up: Math.round((performance.now() - started) / 1000) })]), 1000);

  // The keyboard as the handlebar pad, unless typing.
  const key = (down: boolean) => (event: KeyboardEvent) => {
    const button = KEYS[event.key];
    if (button === undefined || event.repeat || event.target instanceof HTMLInputElement) return;
    event.preventDefault();
    emit([JSON.stringify({ t: 'btn', b: button, s: down ? 1 : 0 })]);
  };
  window.addEventListener('keydown', key(true));
  window.addEventListener('keyup', key(false));

  return {
    send(line) {
      if (line.trim() === HI_LINE) emit([hello()]);
    },
  };
}

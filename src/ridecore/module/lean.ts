/**
 * Lean angle from the module's IMU, mounted flat on the frame with its X arrow to the
 * front (module/README.md): bike axes x forward, y left, z up; lean positive to the right.
 *
 * An accelerometer alone can't see lean in a turn: there the bike leans so the pull it
 * feels is straight down through it, so it reads upright. So the gyro's roll rate
 * carries the lean, and is pulled slowly toward a reference that's right for the moment:
 * - moving: the lean a steady turn needs, tan(lean) = speed × turn rate / g, the turn
 *   rate from the gyro (ψ̇ = ωy sin φ + ωz cos φ);
 * - stopped or crawling: the accelerometer, which is right when nothing turns.
 * Standing still, the gyro's drift is learned and taken off.
 */
import type { ImuSample } from './protocol';

const G = 9.81;
const DEG = Math.PI / 180;
/** Below this the turn reference is noise: the accelerometer leads. */
const MOVING_MPS = 3;
/** How fast the lean is pulled toward the reference, seconds: slow enough to ride through a quick flick. */
const MOVING_TAU_S = 1.5;
const STOPPED_TAU_S = 0.4;
/** Without any speed (no wheel sensor, no GPS fix): the accelerometer, slowly. */
const UNKNOWN_TAU_S = 3;
/** Still: every gyro axis under this, deg/s, and the pull near 1 g. */
const STILL_DPS = 4;
const BIAS_TAU_S = 4;
/** A gap longer than this in the samples (unplugged, the app asleep): start again. */
const GAP_S = 0.5;

export class LeanEstimator {
  /** Radians, positive right. */
  private roll = 0;
  private bias: [number, number, number] = [0, 0, 0];
  private lastMs: number | null = null;
  /** Taken off the accelerometer's lean: the mount's tilt, from "Level" in Settings. */
  levelDeg = 0;

  /** The latest sample; speed in m/s, or null when there's none. Returns the lean in degrees. */
  update(sample: ImuSample, speedMps: number | null): number {
    const [ax, ay, az] = sample.a;
    const accelRoll = Math.atan2(ay, az) - this.levelDeg * DEG;
    const dt = this.lastMs == null ? null : (sample.ms - this.lastMs) / 1000;
    this.lastMs = sample.ms;
    if (dt == null || dt <= 0 || dt > GAP_S) {
      this.roll = accelRoll;
      return this.degrees();
    }

    const gyro = sample.g.map((v, i) => (v / 100 - this.bias[i]!) * DEG) as [number, number, number];
    const [wx, wy, wz] = gyro;
    const steadyPull = Math.abs(Math.hypot(ax, ay, az) / 1000 - 1) < 0.08;
    const quietGyro = sample.g.every((v, i) => Math.abs(v / 100 - this.bias[i]!) < STILL_DPS);
    const stopped = speedMps != null && speedMps < 0.5;

    // Standing still, what the gyro reads is its drift (a cheap one's can be 20°/s).
    // Known stopped is enough; without a speed, the gyro has to be quiet too.
    if (steadyPull && (stopped || (speedMps == null && quietGyro))) {
      const k = Math.min(1, dt / BIAS_TAU_S);
      this.bias = this.bias.map((b, i) => b + (sample.g[i]! / 100 - b) * k) as [number, number, number];
    }

    this.roll += wx * dt;

    let reference: number;
    let tau: number;
    if (speedMps != null && speedMps >= MOVING_MPS) {
      const turnRate = wy * Math.sin(this.roll) + wz * Math.cos(this.roll);
      // Turning right is a clockwise turn rate, and a right lean.
      reference = Math.atan((-speedMps * turnRate) / G);
      tau = MOVING_TAU_S;
    } else {
      reference = accelRoll;
      tau = speedMps == null ? UNKNOWN_TAU_S : STOPPED_TAU_S;
    }
    this.roll += (reference - this.roll) * Math.min(1, dt / tau);
    return this.degrees();
  }

  /** The accelerometer's lean right now, degrees, before levelling: what "Level" takes off. */
  static tiltDeg(sample: ImuSample): number {
    return Math.atan2(sample.a[1], sample.a[2]) / DEG;
  }

  reset(): void {
    this.lastMs = null;
  }

  private degrees(): number {
    return this.roll / DEG;
  }
}

/** "R 24°", "L 8°", "0°": which way and how far, whole degrees. */
export function formatLean(deg: number): string {
  const whole = Math.round(Math.abs(deg));
  if (whole === 0) return '0°';
  return `${deg > 0 ? 'R' : 'L'} ${whole}°`;
}

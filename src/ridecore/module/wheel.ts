/**
 * Speed from the wheel sensor: a magnet on the wheel passing a hall sensor, or the
 * bike's own speed signal. Instant, and it keeps going where GPS drops (tunnels,
 * underpasses, under flyovers).
 */
import type { WheelReading } from './protocol';

export interface WheelSetup {
  /** How far the wheel rolls in one turn, metres. */
  circumferenceM: number;
  /** Pulses a turn: the magnets on it, or the speed signal's pulses. */
  pulsesPerRev: number;
}

/** Common motorcycle wheels, tapped through in Settings: 1.95 m is a 120/80-17 rear. */
export const WHEEL_CIRCUMFERENCES = [1.8, 1.85, 1.9, 1.95, 2.0, 2.05, 2.1, 2.15];
export const WHEEL_PULSES = [1, 2, 3, 4];
export const DEFAULT_WHEEL: WheelSetup = { circumferenceM: 1.95, pulsesPerRev: 1 };

/** No pulse for this long: stopped. Slower than about 2.3 km/h on one magnet. */
export const STOPPED_AFTER_MS = 3000;

/**
 * km/h from a reading; null until the sensor has pulsed at all (nothing on the input).
 * Slowing down, the wait since the last pulse is already longer than the last period:
 * the speed can't be more than that wait allows, so it falls as it should.
 */
export function wheelKmh(reading: WheelReading, setup: WheelSetup): number | null {
  if (reading.n <= 0) return null;
  if (reading.age >= STOPPED_AFTER_MS || reading.p <= 0) return 0;
  const periodS = Math.max(reading.p / 1e6, reading.age / 1e3);
  const metresPerPulse = setup.circumferenceM / Math.max(1, setup.pulsesPerRev);
  return (metresPerPulse / periodS) * 3.6;
}

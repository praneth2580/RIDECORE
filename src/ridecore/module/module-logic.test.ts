import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ButtonReader, HOLD_MS, type Press } from './buttons';
import { formatLean, LeanEstimator } from './lean';
import { parseLine, type ImuSample } from './protocol';
import { DEFAULT_WHEEL, STOPPED_AFTER_MS, wheelKmh } from './wheel';

describe('the module protocol', () => {
  it('reads each message', () => {
    expect(parseLine('{"t":"hello","v":1,"fw":"1.0.0","btn":5,"whl":true,"imu":"MPU-6050","hz":50}')).toEqual({
      t: 'hello',
      v: 1,
      fw: '1.0.0',
      btn: 5,
      whl: true,
      imu: 'MPU-6050',
      hz: 50,
    });
    expect(parseLine('{"t":"hello","v":1,"fw":"1.0.0","btn":5,"whl":true,"imu":null}')).toMatchObject({ imu: null, hz: 50 });
    expect(parseLine('{"t":"btn","b":4,"s":1}\r')).toEqual({ t: 'btn', b: 4, s: 1 });
    expect(parseLine('{"t":"whl","n":12,"p":72000,"age":30}')).toEqual({ t: 'whl', n: 12, p: 72000, age: 30 });
    expect(parseLine('{"t":"imu","ms":1000,"a":[0,12,998],"g":[-5,0,140]}')).toEqual({ t: 'imu', ms: 1000, a: [0, 12, 998], g: [-5, 0, 140] });
    expect(parseLine('{"t":"hb","up":42}')).toEqual({ t: 'hb', up: 42 });
  });

  it('drops anything else: half lines, boot noise, wrong shapes', () => {
    for (const line of ['', 'ESP-ROM:esp32s3-20210327', '"t":"btn","b":1,"s":1}', '{"t":"btn","b":1', '{"t":"btn","b":1,"s":2}', '{"t":"imu","ms":1,"a":[1,2],"g":[1,2,3]}', '{"t":"nope"}', '[1,2]', 'null']) {
      expect(parseLine(line)).toBeNull();
    }
  });
});

describe('wheel speed', () => {
  const reading = (n: number, p: number, age: number) => ({ t: 'whl' as const, n, p, age });

  it('is nothing until the sensor has pulsed', () => {
    expect(wheelKmh(reading(0, 0, 65535), DEFAULT_WHEEL)).toBeNull();
  });

  it('turns the pulse period into km/h with the wheel set', () => {
    // 1.95 m a turn every 0.117 s is 16.67 m/s: 60 km/h.
    expect(wheelKmh(reading(50, 117_000, 20), DEFAULT_WHEEL)).toBeCloseTo(60, 0);
    // Four magnets: a pulse every quarter turn.
    expect(wheelKmh(reading(200, 29_250, 5), { circumferenceM: 1.95, pulsesPerRev: 4 })).toBeCloseTo(60, 0);
  });

  it('falls while slowing, before the next pulse comes', () => {
    expect(wheelKmh(reading(50, 117_000, 234), DEFAULT_WHEEL)).toBeCloseTo(30, 0);
  });

  it('is 0 once stopped', () => {
    expect(wheelKmh(reading(50, 117_000, STOPPED_AFTER_MS), DEFAULT_WHEEL)).toBe(0);
    expect(wheelKmh(reading(1, 0, 10), DEFAULT_WHEEL)).toBe(0);
  });
});

describe('lean angle', () => {
  const HZ = 50;
  const DT_MS = 1000 / HZ;
  const sample = (ms: number, a: [number, number, number], gDps: [number, number, number]): ImuSample => ({
    t: 'imu',
    ms,
    a,
    g: gDps.map((v) => Math.round(v * 100)) as [number, number, number],
  });

  /** Runs the estimator for seconds of samples from `at`, returning the last lean. */
  function ride(lean: LeanEstimator, seconds: number, make: (ms: number) => ImuSample, speed: number | null, from = 0): number {
    let out = 0;
    for (let ms = from; ms <= from + seconds * 1000; ms += DT_MS) out = lean.update(make(ms), speed);
    return out;
  }

  it('reads upright standing still', () => {
    expect(ride(new LeanEstimator(), 2, (ms) => sample(ms, [0, 0, 1000], [0, 0, 0]), 0)).toBeCloseTo(0, 1);
  });

  it('reads the bike tilted on its stand', () => {
    const tilt = -12 * (Math.PI / 180);
    const lean = ride(new LeanEstimator(), 3, (ms) => sample(ms, [0, Math.sin(tilt) * 1000, Math.cos(tilt) * 1000], [0, 0, 0]), 0);
    expect(lean).toBeCloseTo(-12, 0);
  });

  it('finds the lean of a steady right turn, where the accelerometer reads upright', () => {
    // 15 m/s turning right at 0.5 rad/s needs atan(15 × 0.5 / 9.81) = 37.4°.
    const speed = 15;
    const yaw = -0.5;
    const phi = Math.atan((speed * -yaw) / 9.81);
    const pull = 1000 / Math.cos(phi);
    const dps = (rad: number) => (rad * 180) / Math.PI;
    const turn = (ms: number) => sample(ms, [0, 0, pull], [0, dps(yaw * Math.sin(phi)), dps(yaw * Math.cos(phi))]);
    const lean = ride(new LeanEstimator(), 8, turn, speed);
    expect(lean).toBeGreaterThan(35.5);
    expect(lean).toBeLessThan(39.5);
  });

  it('follows a quick lean in from the gyro, before the reference catches up', () => {
    const estimator = new LeanEstimator();
    ride(estimator, 1, (ms) => sample(ms, [0, 0, 1000], [0, 0, 0]), 15);
    // Rolling right at 60°/s for half a second, still riding straight: the gyro carries it.
    const lean = ride(estimator, 0.5, (ms) => sample(ms, [0, 0, 1000], [60, 0, 0]), 15, 1020);
    expect(lean).toBeGreaterThan(22);
  });

  it('learns the gyro drift standing still, so the lean stays put', () => {
    const lean = ride(new LeanEstimator(), 60, (ms) => sample(ms, [0, 0, 1000], [6, -3, 2]), 0);
    expect(Math.abs(lean)).toBeLessThan(1);
  });

  it('takes the mount tilt off once levelled', () => {
    const tilt = 4 * (Math.PI / 180);
    const tilted = (ms: number) => sample(ms, [0, Math.sin(tilt) * 1000, Math.cos(tilt) * 1000], [0, 0, 0]);
    expect(LeanEstimator.tiltDeg(tilted(0))).toBeCloseTo(4, 3);
    const estimator = new LeanEstimator();
    estimator.levelDeg = 4;
    expect(ride(estimator, 2, tilted, 0)).toBeCloseTo(0, 1);
  });

  it('reads which way and how far', () => {
    expect(formatLean(24.4)).toBe('R 24°');
    expect(formatLean(-8.6)).toBe('L 9°');
    expect(formatLean(0.3)).toBe('0°');
  });
});

describe('the buttons', () => {
  let presses: Press[];
  let reader: ButtonReader;
  beforeEach(() => {
    vi.useFakeTimers();
    presses = [];
    reader = new ButtonReader((press) => presses.push(press));
  });
  afterEach(() => vi.useRealTimers());

  it('taps when let go quickly', () => {
    reader.edge(2, true);
    vi.advanceTimersByTime(120);
    reader.edge(2, false);
    expect(presses).toEqual([{ button: 'left', hold: false }]);
  });

  it('holds once kept down, while still down, and not a tap after', () => {
    reader.edge(4, true);
    vi.advanceTimersByTime(HOLD_MS);
    expect(presses).toEqual([{ button: 'ok', hold: true }]);
    vi.advanceTimersByTime(2000);
    reader.edge(4, false);
    expect(presses).toHaveLength(1);
  });

  it('keeps buttons apart, ignores ones it has no name for, and forgets on reset', () => {
    reader.edge(0, true);
    reader.edge(1, true);
    reader.edge(9, true);
    reader.edge(0, false);
    reader.reset();
    vi.advanceTimersByTime(HOLD_MS * 2);
    reader.edge(1, false);
    expect(presses).toEqual([{ button: 'up', hold: false }]);
  });
});

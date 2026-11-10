/**
 * What RIDECORE's handlebar module sends over USB: one JSON object a line, short keys
 * (module/README.md → Protocol, module/src/main.cpp). Anything else on the line is
 * dropped: a half line as it's plugged in, a boot message from the board.
 */

/** The protocol this app speaks; a module saying another is shown as needing an update. */
export const PROTOCOL_VERSION = 1;

/** What the module has: sent as it starts, and whenever the phone says hi. */
export interface Hello {
  t: 'hello';
  /** Protocol version. */
  v: number;
  /** Firmware version. */
  fw: string;
  /** The board, as the sketch knows it ("Arduino Nano"); left out by firmware before 1.1. */
  board?: string;
  /** How many buttons are wired, in order: up, down, left, right, ok. */
  btn: number;
  /** A wheel sensor input. Whether a sensor is on it shows when it pulses. */
  whl: boolean;
  /** The IMU found ("MPU-6050"), or null without one. */
  imu: string | null;
  /** IMU samples a second. */
  hz: number;
}

/** A button went down (s 1) or up (s 0), debounced. */
export interface ButtonEdge {
  t: 'btn';
  b: number;
  s: 0 | 1;
}

/**
 * The wheel sensor, ten times a second: n pulses so far, p microseconds a pulse lately
 * (0 before two), age milliseconds since the last.
 */
export interface WheelReading {
  t: 'whl';
  n: number;
  p: number;
  age: number;
}

/** One IMU sample: accelerometer in mg and gyro in hundredths of a degree a second, sensor axes. */
export interface ImuSample {
  t: 'imu';
  /** The board's clock, ms. */
  ms: number;
  a: [number, number, number];
  g: [number, number, number];
}

/** Once a second, so a quiet module is known to be there. */
export interface Heartbeat {
  t: 'hb';
  /** Seconds since the board started. */
  up: number;
}

export type ModuleMessage = Hello | ButtonEdge | WheelReading | ImuSample | Heartbeat;

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isTriple = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every(isNumber);

/** A line from the module as a message; null for anything that isn't one. */
export function parseLine(line: string): ModuleMessage | null {
  const text = line.trim();
  if (!text.startsWith('{')) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  switch (m.t) {
    case 'hello':
      if (!isNumber(m.v) || typeof m.fw !== 'string' || !isNumber(m.btn) || typeof m.whl !== 'boolean') return null;
      return {
        t: 'hello',
        v: m.v,
        fw: m.fw,
        ...(typeof m.board === 'string' && m.board ? { board: m.board } : {}),
        btn: m.btn,
        whl: m.whl,
        imu: typeof m.imu === 'string' && m.imu ? m.imu : null,
        hz: isNumber(m.hz) && m.hz > 0 ? m.hz : 50,
      };
    case 'btn':
      if (!isNumber(m.b) || (m.s !== 0 && m.s !== 1)) return null;
      return { t: 'btn', b: m.b, s: m.s };
    case 'whl':
      if (!isNumber(m.n) || !isNumber(m.p) || !isNumber(m.age)) return null;
      return { t: 'whl', n: m.n, p: m.p, age: m.age };
    case 'imu':
      if (!isNumber(m.ms) || !isTriple(m.a) || !isTriple(m.g)) return null;
      return { t: 'imu', ms: m.ms, a: m.a, g: m.g };
    case 'hb':
      return isNumber(m.up) ? { t: 'hb', up: m.up } : null;
    default:
      return null;
  }
}

/** The phone asking the module what it has: it answers with hello. */
export const HI_LINE = JSON.stringify({ t: 'hi' });

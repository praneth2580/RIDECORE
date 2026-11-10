/**
 * RIDECORE's handlebar module (module/README.md): an ESP32-S3 on USB with the bike's
 * buttons, a wheel speed sensor and an IMU. This follows it for as long as RIDECORE
 * runs: the buttons as presses, the wheel as speed, the IMU as lean, for the screens.
 */
import { useSyncExternalStore } from 'react';
import { ButtonReader, type Press } from './buttons';
import { actionFor, loadButtons, saveButtons, type ButtonAction, type ButtonSettings } from './buttonmap';
import { LeanEstimator } from './lean';
import { moduleLink, type LinkState, type NativePress } from './link';
import { HI_LINE, parseLine, PROTOCOL_VERSION, type Hello, type ImuSample, type WheelReading } from './protocol';
import { DEFAULT_WHEEL, wheelKmh, type WheelSetup } from './wheel';

export { formatLean } from './lean';
export type { Press, ButtonName } from './buttons';
export { BUTTONS } from './buttons';
export * from './buttonmap';
export { MODULE_BOARDS, PICO_BOARDS_URL, pinLabel, type ModuleBoard } from './boards';
export { WHEEL_CIRCUMFERENCES, WHEEL_PULSES } from './wheel';

/** A button pressed, and what it's set to do. */
export interface ModuleAction {
  action: ButtonAction;
  press: Press;
  /** The phone did it already (volume, calls, music behind another app). */
  done: boolean;
  /** Why the phone couldn't, for the rider. */
  problem?: string;
}

export interface LeanReading {
  /** Degrees, positive right. */
  deg: number;
  /** The most each way since the ride started (or the module was plugged in), riding. */
  maxLeft: number;
  maxRight: number;
}

export interface ModuleSnapshot {
  link: LinkState['state'];
  name?: string;
  error?: string;
  /** What the module said it has; null until it says. */
  hello: Hello | null;
  /** The phone permission for answering and ending calls from a button. */
  calls?: LinkState['calls'];
  /** Its firmware speaks another protocol: shown, and needs flashing. */
  outdated: boolean;
  /** Lines arriving: false when it's gone quiet. */
  live: boolean;
  /** km/h; null without a wheel sensor pulsing. */
  wheelKmh: number | null;
  lean: LeanReading | null;
}

export interface ModuleSettings extends WheelSetup {
  /** The mount's tilt, taken off the lean ("Level" in Settings). */
  levelDeg: number;
}

const SETTINGS_KEY = 'ridecore.module';
/** Quiet this long: the module isn't sending (unplugged, hung). */
const QUIET_MS = 3000;
/** The screens hear about speed and lean at most this often. */
const EMIT_MS = 100;
/** Only riding counts toward the most lean: not the side stand's tilt. */
const RIDING_MPS = 3;
/** How long "Level" averages the tilt over, samples. */
const LEVEL_SAMPLES = 25;

export function loadModuleSettings(): ModuleSettings {
  const settings: ModuleSettings = { ...DEFAULT_WHEEL, levelDeg: 0 };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    if (saved && typeof saved === 'object') {
      const s = saved as Record<string, unknown>;
      if (typeof s.circumferenceM === 'number' && s.circumferenceM > 0.5 && s.circumferenceM < 4) settings.circumferenceM = s.circumferenceM;
      if (typeof s.pulsesPerRev === 'number' && s.pulsesPerRev >= 1 && s.pulsesPerRev <= 64) settings.pulsesPerRev = Math.round(s.pulsesPerRev);
      if (typeof s.levelDeg === 'number' && Math.abs(s.levelDeg) < 45) settings.levelDeg = s.levelDeg;
    }
  } catch {
    // Unreadable: the defaults.
  }
  return settings;
}

// ── State, kept for as long as RIDECORE runs ────────────────────────────────

let settings = loadModuleSettings();
/** Changed as lines come in; published to the screens as `snapshot` (a new object each time). */
const state: ModuleSnapshot = { link: 'unsupported', hello: null, outdated: false, live: false, wheelKmh: null, lean: null };
let snapshot: ModuleSnapshot = { ...state };
const listeners = new Set<() => void>();
const actionListeners = new Set<(event: ModuleAction) => void>();
let buttonSettings = loadButtons();
// In a browser the simulator's buttons are read here; on the phone, natively.
const buttons = new ButtonReader((press) => act({ action: actionFor(buttonSettings.map, press), press, done: false }));

function act(event: ModuleAction): void {
  for (const listener of actionListeners) listener(event);
}

/** A press read by the phone: done there, or the page's to do. */
function onNativePress(press: NativePress): void {
  const asPress = { button: press.button, hold: press.hold };
  const action = press.action === 'page' ? actionFor(buttonSettings.map, asPress) : press.action;
  act({ action, press: asPress, done: press.done, problem: press.problem });
}

function sendButtons(): void {
  void moduleLink.setButtons({ map: buttonSettings.map, callsOnOk: buttonSettings.callsOnOk }).catch(() => undefined);
}
const lean = new LeanEstimator();
lean.levelDeg = settings.levelDeg;
let lastWheel: WheelReading | null = null;
let gpsMps: number | null = null;
let lastDataAt = 0;
let maxLeft = 0;
let maxRight = 0;
let recentTilt: number[] = [];
let emitTimer: ReturnType<typeof setTimeout> | undefined;

function emit(): void {
  clearTimeout(emitTimer);
  emitTimer = undefined;
  snapshot = { ...state };
  for (const listener of listeners) listener();
}

/** Speed and lean change fifty times a second; the screens redraw ten. */
function emitSoon(): void {
  emitTimer ??= setTimeout(emit, EMIT_MS);
}

function set(patch: Partial<ModuleSnapshot>, now = true): void {
  Object.assign(state, patch);
  if (now) emit();
  else emitSoon();
}

/** Metres a second for the lean: the wheel's, else the GPS's. */
function speedMps(): number | null {
  return state.wheelKmh != null ? state.wheelKmh / 3.6 : gpsMps;
}

function onLine(line: string): void {
  const message = parseLine(line);
  if (!message) return;
  lastDataAt = Date.now();
  if (!state.live) set({ live: true }, false);
  switch (message.t) {
    case 'hello':
      set({ hello: message, outdated: message.v !== PROTOCOL_VERSION });
      break;
    case 'btn':
      buttons.edge(message.b, message.s === 1);
      break;
    case 'whl':
      lastWheel = message;
      set({ wheelKmh: wheelKmh(message, settings) }, false);
      break;
    case 'imu':
      onImu(message);
      break;
    case 'hb':
      break;
  }
}

function onImu(sample: ImuSample): void {
  const speed = speedMps();
  const deg = lean.update(sample, speed);
  recentTilt.push(LeanEstimator.tiltDeg(sample));
  if (recentTilt.length > LEVEL_SAMPLES) recentTilt.shift();
  if (speed != null && speed >= RIDING_MPS) {
    maxLeft = Math.max(maxLeft, -deg);
    maxRight = Math.max(maxRight, deg);
  }
  set({ lean: { deg, maxLeft, maxRight } }, false);
}

function onState(link: LinkState): void {
  const opened = link.state === 'open' && state.link !== 'open';
  set({ link: link.state, name: link.name, error: link.error, ...(link.calls ? { calls: link.calls } : {}) });
  if (link.state !== 'open') {
    buttons.reset();
    lean.reset();
    set({ hello: null, live: false, wheelKmh: null, lean: null, outdated: false });
  }
  if (opened) greet();
}

/** Asks what the module has; again if it doesn't answer (it may still be starting). */
function greet(attempt = 0): void {
  void moduleLink.send({ line: HI_LINE }).catch(() => undefined);
  setTimeout(() => {
    if (state.link === 'open' && !state.hello && attempt < 4) greet(attempt + 1);
  }, 1500);
}

/** Starts following the module; the returned function stops it. */
export function followModule(): () => void {
  let live = true;
  void moduleLink
    .getState()
    .then((link) => live && onState(link))
    .catch(() => undefined);
  const stateHandle = moduleLink.addListener('state', (link) => live && onState(link));
  const linesHandle = moduleLink.addListener('lines', ({ lines }) => {
    if (live) for (const line of lines) onLine(line);
  });
  const pressHandle = moduleLink.addListener('press', (press) => live && onNativePress(press));
  sendButtons();
  // Gone quiet: no speed or lean to show, though it may still be plugged in.
  const watchdog = setInterval(() => {
    if (state.live && Date.now() - lastDataAt > QUIET_MS) {
      buttons.reset();
      lean.reset();
      set({ live: false, wheelKmh: null, lean: null });
    }
  }, 1000);
  return () => {
    live = false;
    clearInterval(watchdog);
    void stateHandle.then((h) => h.remove());
    void linesHandle.then((h) => h.remove());
    void pressHandle.then((h) => h.remove());
  };
}

/** The phone's own speed, for the lean when there's no wheel sensor. */
export function setGpsSpeed(mps: number | null): void {
  gpsMps = mps;
}

/** A button pressed on the handlebar, and what it's set to do. Returns the way to stop listening. */
export function onModuleAction(listener: (event: ModuleAction) => void): () => void {
  actionListeners.add(listener);
  return () => actionListeners.delete(listener);
}

export function getButtonSettings(): ButtonSettings {
  return buttonSettings;
}

/** What each button does: kept, and given to the phone to act on. */
export function setButtonSettings(next: ButtonSettings): void {
  buttonSettings = next;
  saveButtons(next);
  sendButtons();
}

/** Asks for the phone permission for calls; true once given. */
export async function allowModuleCalls(): Promise<boolean> {
  try {
    const { calls } = await moduleLink.allowCalls();
    set({ calls });
    return calls === 'granted';
  } catch {
    return false;
  }
}

/** Finds the module again, asking for USB access if it needs it. */
export function connectModule(): void {
  void moduleLink
    .connect()
    .then(onState)
    .catch(() => undefined);
}

export function getModuleSettings(): ModuleSettings {
  return settings;
}

export function saveModuleSettings(next: ModuleSettings): void {
  settings = next;
  lean.levelDeg = next.levelDeg;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Kept for this run.
  }
  if (lastWheel) set({ wheelKmh: wheelKmh(lastWheel, next) });
}

/**
 * The bike upright and still: its tilt now is the mount's, taken off from here on.
 * False without IMU samples to go by.
 */
export function levelLean(): boolean {
  if (recentTilt.length === 0) return false;
  const tilt = recentTilt.reduce((sum, t) => sum + t, 0) / recentTilt.length;
  saveModuleSettings({ ...settings, levelDeg: tilt });
  lean.reset();
  return true;
}

/** A ride starting: the most lean counts from here. */
export function resetMaxLean(): void {
  maxLeft = 0;
  maxRight = 0;
  if (state.lean) set({ lean: { ...state.lean, maxLeft, maxRight } });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useModule(): ModuleSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/** The wheel's speed, km/h, or null: redraws only what shows it. */
export function useWheelKmh(): number | null {
  return useSyncExternalStore(subscribe, () => snapshot.wheelKmh);
}

export function useLean(): LeanReading | null {
  return useSyncExternalStore(subscribe, () => snapshot.lean);
}

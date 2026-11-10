/**
 * What each of the module's buttons does, tapped and held: the rider's to set
 * (Settings → Handlebar module → Buttons). The phone does the ones about the phone
 * (calls, volume, and music behind another app) itself, natively, so they work with
 * another app in front (RideCoreModulePlugin.java); the page does the screens.
 */
import { BUTTONS, type ButtonName, type Press } from './buttons';

export const BUTTON_ACTIONS = [
  'none',
  'screen-up',
  'screen-down',
  'screen-left',
  'screen-right',
  'dash',
  'back',
  'next-face',
  'voice',
  'play-pause',
  'next-track',
  'previous-track',
  'volume-up',
  'volume-down',
  'answer-call',
  'end-call',
] as const;
export type ButtonAction = (typeof BUTTON_ACTIONS)[number];

export const ACTION_NAMES: Record<ButtonAction, string> = {
  none: 'Nothing',
  'screen-up': 'Screen above',
  'screen-down': 'Screen below',
  'screen-left': 'Screen left',
  'screen-right': 'Screen right',
  dash: 'Dash (Home)',
  back: 'Back',
  'next-face': 'Next dial view',
  voice: 'Voice on / off',
  'play-pause': 'Play / pause',
  'next-track': 'Next track',
  'previous-track': 'Previous track',
  'volume-up': 'Volume up',
  'volume-down': 'Volume down',
  'answer-call': 'Answer call',
  'end-call': 'End / reject call',
};

/** How the action list is grouped where the rider picks one. */
export const ACTION_GROUPS: { title: string; actions: ButtonAction[] }[] = [
  { title: 'Screens', actions: ['screen-up', 'screen-down', 'screen-left', 'screen-right', 'dash', 'back'] },
  { title: 'Music', actions: ['play-pause', 'next-track', 'previous-track', 'volume-up', 'volume-down'] },
  { title: 'Calls', actions: ['answer-call', 'end-call'] },
  { title: 'Dash', actions: ['next-face', 'voice', 'none'] },
];

/** Done by the phone itself: in a browser there's nothing to do them with. */
export const PHONE_ACTIONS: ReadonlySet<ButtonAction> = new Set(['volume-up', 'volume-down', 'answer-call', 'end-call']);
/** Need the phone permission to answer and end calls. */
export const CALL_ACTIONS: ReadonlySet<ButtonAction> = new Set(['answer-call', 'end-call']);

export type ButtonKey = `${ButtonName}.${'tap' | 'hold'}`;
export type ButtonMap = Record<ButtonKey, ButtonAction>;

export const BUTTON_KEYS: ButtonKey[] = BUTTONS.flatMap((button) => [`${button}.tap`, `${button}.hold`] as ButtonKey[]);

/** The pad as it comes: the arrows go where swipes go, holds work the music; OK plays, held it's Home. */
export const DEFAULT_BUTTON_MAP: ButtonMap = {
  'up.tap': 'screen-up',
  'up.hold': 'volume-up',
  'down.tap': 'screen-down',
  'down.hold': 'volume-down',
  'left.tap': 'screen-left',
  'left.hold': 'previous-track',
  'right.tap': 'screen-right',
  'right.hold': 'next-track',
  'ok.tap': 'play-pause',
  'ok.hold': 'dash',
};

export interface ButtonSettings {
  map: ButtonMap;
  /** While the phone rings OK answers (held, it rejects), and in a call held OK hangs up. */
  callsOnOk: boolean;
}

export const DEFAULT_BUTTONS: ButtonSettings = { map: DEFAULT_BUTTON_MAP, callsOnOk: false };

const KEY = 'ridecore.buttons';
const isAction = (value: unknown): value is ButtonAction => typeof value === 'string' && (BUTTON_ACTIONS as readonly string[]).includes(value);

/** As saved; anything missing or unknown is the default. */
export function loadButtons(): ButtonSettings {
  const settings: ButtonSettings = { map: { ...DEFAULT_BUTTON_MAP }, callsOnOk: false };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (saved && typeof saved === 'object') {
      const { map, callsOnOk } = saved as { map?: Record<string, unknown>; callsOnOk?: unknown };
      if (map && typeof map === 'object') {
        for (const key of BUTTON_KEYS) if (isAction(map[key])) settings.map[key] = map[key];
      }
      settings.callsOnOk = callsOnOk === true;
    }
  } catch {
    // Unreadable: the defaults.
  }
  return settings;
}

export function saveButtons(settings: ButtonSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Kept for this run.
  }
}

export function actionFor(map: ButtonMap, press: Press): ButtonAction {
  return map[`${press.button}.${press.hold ? 'hold' : 'tap'}`];
}

/** The map uses an action that needs the phone permission for calls. */
export function usesCalls(settings: ButtonSettings): boolean {
  return settings.callsOnOk || BUTTON_KEYS.some((key) => CALL_ACTIONS.has(settings.map[key]));
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTION_GROUPS, ACTION_NAMES, actionFor, BUTTON_ACTIONS, BUTTON_KEYS, DEFAULT_BUTTON_MAP, loadButtons, saveButtons, usesCalls } from './buttonmap';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
});

describe('the button map', () => {
  beforeEach(() => store.clear());

  it('has a tap and a hold for each of the five buttons, each set by default', () => {
    expect(BUTTON_KEYS).toHaveLength(10);
    for (const key of BUTTON_KEYS) expect(BUTTON_ACTIONS).toContain(DEFAULT_BUTTON_MAP[key]);
  });

  it('offers every action somewhere, each with a name', () => {
    const offered = ACTION_GROUPS.flatMap((group) => group.actions).sort();
    expect(offered).toEqual([...BUTTON_ACTIONS].sort());
    for (const action of BUTTON_ACTIONS) expect(ACTION_NAMES[action]).toBeTruthy();
  });

  it('reads a press as its action', () => {
    expect(actionFor(DEFAULT_BUTTON_MAP, { button: 'ok', hold: false })).toBe('play-pause');
    expect(actionFor(DEFAULT_BUTTON_MAP, { button: 'ok', hold: true })).toBe('dash');
    expect(actionFor(DEFAULT_BUTTON_MAP, { button: 'right', hold: true })).toBe('next-track');
  });

  it('keeps what the rider set, and the default for anything missing or unknown', () => {
    saveButtons({ map: { ...DEFAULT_BUTTON_MAP, 'ok.tap': 'answer-call' }, callsOnOk: true });
    expect(loadButtons().map['ok.tap']).toBe('answer-call');
    expect(loadButtons().callsOnOk).toBe(true);
    store.set('ridecore.buttons', JSON.stringify({ map: { 'up.tap': 'launch-rockets', 'down.hold': 'voice' } }));
    const loaded = loadButtons();
    expect(loaded.map['up.tap']).toBe('screen-up');
    expect(loaded.map['down.hold']).toBe('voice');
    expect(loaded.callsOnOk).toBe(false);
    store.set('ridecore.buttons', '{oops');
    expect(loadButtons().map).toEqual(DEFAULT_BUTTON_MAP);
  });

  it('knows when the phone permission for calls is needed', () => {
    expect(usesCalls({ map: DEFAULT_BUTTON_MAP, callsOnOk: false })).toBe(false);
    expect(usesCalls({ map: DEFAULT_BUTTON_MAP, callsOnOk: true })).toBe(true);
    expect(usesCalls({ map: { ...DEFAULT_BUTTON_MAP, 'left.hold': 'end-call' }, callsOnOk: false })).toBe(true);
  });
});

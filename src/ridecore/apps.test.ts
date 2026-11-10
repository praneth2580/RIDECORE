import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPicks, PICKS_MAX, pickedApps, pickNote, togglePick } from './apps';
import type { PhoneApp } from './device';

vi.mock('./device', () => ({ device: {} }));
vi.mock('@capacitor/app', () => ({ App: {} }));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
});

const app = (packageName: string, label = packageName, activity?: string): PhoneApp => ({ packageName, label, activity });
const names = (count: number) => Array.from({ length: count }, (_, i) => `app.${i}`);

describe('picked apps', () => {
  beforeEach(() => store.clear());

  it('keeps the apps pinned before, up to the most there is room for', () => {
    store.set('ridecore.pinnedApps', JSON.stringify([...names(PICKS_MAX + 3), 'app.0', 7]));
    expect(loadPicks()).toEqual(names(PICKS_MAX));
  });

  it('starts empty, and with nothing readable', () => {
    expect(loadPicks()).toEqual([]);
    store.set('ridecore.pinnedApps', '{not json');
    expect(loadPicks()).toEqual([]);
    store.set('ridecore.pinnedApps', '"spotify"');
    expect(loadPicks()).toEqual([]);
  });

  it('adds to the end and takes off from anywhere', () => {
    let { picks, change } = togglePick(['maps', 'phone'], 'spotify');
    expect(change).toBe('added');
    expect(picks).toEqual(['maps', 'phone', 'spotify']);
    ({ picks, change } = togglePick(picks, 'maps'));
    expect(change).toBe('removed');
    expect(picks).toEqual(['phone', 'spotify']);
  });

  it(`adds nothing past ${PICKS_MAX}, but still takes one off`, () => {
    const full = names(PICKS_MAX);
    expect(togglePick(full, 'spotify')).toEqual({ picks: full, change: 'full' });
    expect(togglePick(full, 'app.3').change).toBe('removed');
  });

  it('shows the picks in the order picked, leaving out apps gone from the phone', () => {
    const apps = [app('a', 'Alpha'), app('m', 'Maps'), app('s', 'Spotify')];
    expect(pickedApps(apps, ['s', 'gone', 'a']).map((a) => a.label)).toEqual(['Spotify', 'Alpha']);
  });

  it('shows an app with two ways in once', () => {
    const apps = [app('cam', 'Camera', 'Main'), app('cam', 'Video', 'Video')];
    expect(pickedApps(apps, ['cam'])).toEqual([apps[0]]);
  });

  it('tells the rider what happened', () => {
    expect(pickNote(app('s', 'Spotify'), 'added', 3)).toBe(`Spotify on Apps (3 of ${PICKS_MAX})`);
    expect(pickNote(app('s', 'Spotify'), 'removed', 2)).toBe('Spotify taken off Apps');
    expect(pickNote(app('s', 'Spotify'), 'full', PICKS_MAX)).toMatch(/full/);
  });
});

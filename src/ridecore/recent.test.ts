import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlace, loadRecentPlaces, RECENT_MAX, rememberPlace, type RecentPlace } from './recent';

vi.mock('./engine', () => ({ createTripStop: vi.fn() }));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
});

const place = (name: string, lng = 72.85, lat = 19.16): RecentPlace => ({ name, coordinate: [lng, lat] });

describe('recent places', () => {
  beforeEach(() => store.clear());

  it('starts empty, newest first after that', () => {
    expect(loadRecentPlaces()).toEqual([]);
    rememberPlace(place('Home'));
    rememberPlace(place('Work', 72.9));
    expect(loadRecentPlaces().map((p) => p.name)).toEqual(['Work', 'Home']);
  });

  it('moves a place gone to again to the front instead of adding it twice', () => {
    rememberPlace(place('Home'));
    rememberPlace(place('Work', 72.9));
    rememberPlace(place('Home', 72.85001));
    expect(loadRecentPlaces().map((p) => p.name)).toEqual(['Home', 'Work']);
  });

  it('keeps two places of the same name far apart', () => {
    rememberPlace(place('Station'));
    rememberPlace(place('Station', 73.1));
    expect(loadRecentPlaces()).toHaveLength(2);
  });

  it(`keeps the newest ${RECENT_MAX}`, () => {
    for (let i = 0; i < RECENT_MAX + 3; i++) rememberPlace(place(`P${i}`, 72 + i));
    const names = loadRecentPlaces().map((p) => p.name);
    expect(names).toHaveLength(RECENT_MAX);
    expect(names[0]).toBe(`P${RECENT_MAX + 2}`);
  });

  it('forgets a place', () => {
    rememberPlace(place('Home'));
    rememberPlace(place('Work', 72.9));
    forgetPlace(place('Home'));
    expect(loadRecentPlaces().map((p) => p.name)).toEqual(['Work']);
  });

  it('skips anything saved wrong', () => {
    store.set('ridecore.recentPlaces', JSON.stringify([{ name: 'Ok', coordinate: [1, 2] }, { name: 'Bad' }, 'x']));
    expect(loadRecentPlaces().map((p) => p.name)).toEqual(['Ok']);
    store.set('ridecore.recentPlaces', '{nope');
    expect(loadRecentPlaces()).toEqual([]);
  });
});

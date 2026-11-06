import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DASH_SHOWS_ALL, loadDashShows, saveDashShows } from './dash';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
});

describe('what the dash shows', () => {
  beforeEach(() => store.clear());

  it('shows everything at first', () => {
    expect(loadDashShows()).toEqual(DASH_SHOWS_ALL);
  });

  it('keeps what the rider switched off', () => {
    saveDashShows({ ...DASH_SHOWS_ALL, map: false, battery: false });
    expect(loadDashShows()).toEqual({ ...DASH_SHOWS_ALL, map: false, battery: false });
  });

  it('shows anything saved before it existed, or saved wrong', () => {
    store.set('ridecore.dash', JSON.stringify({ speed: false, trip: 'no', extra: false }));
    expect(loadDashShows()).toEqual({ ...DASH_SHOWS_ALL, speed: false });
    store.set('ridecore.dash', 'not json');
    expect(loadDashShows()).toEqual(DASH_SHOWS_ALL);
  });
});

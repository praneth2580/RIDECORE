import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FAVOURITES_MAX, loadFavourites, parseStations, radioCountry, toggleFavourite, type RadioStation } from './radio';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
});

const raw = (over: Record<string, unknown>) => ({
  stationuuid: 'id-1',
  name: 'Radio One',
  url: 'https://one.example/stream',
  url_resolved: 'https://one.example/live.mp3',
  favicon: 'https://one.example/logo.png',
  tags: 'bollywood, hindi,  music ,news',
  ...over,
});

describe('radio stations', () => {
  it('keeps HTTPS streams, each name once, with two tags', () => {
    const stations = parseStations([
      raw({}),
      raw({ stationuuid: 'id-2', name: '  radio   ONE ' }),
      raw({ stationuuid: 'id-3', name: 'Plain', url: 'http://x', url_resolved: 'http://x/live' }),
      raw({ stationuuid: 'id-4', name: 'Fallback', url_resolved: '', favicon: 'http://logo' }),
      raw({ stationuuid: '', name: 'No id' }),
      'junk',
    ]);
    expect(stations).toEqual([
      { id: 'id-1', name: 'Radio One', url: 'https://one.example/live.mp3', favicon: 'https://one.example/logo.png', tags: 'bollywood, hindi' },
      { id: 'id-4', name: 'Fallback', url: 'https://one.example/stream', favicon: undefined, tags: 'bollywood, hindi' },
    ]);
    expect(parseStations({ not: 'a list' })).toEqual([]);
  });

  it("lists India's by its time zone, else the phone's region", () => {
    expect(radioCountry('Asia/Kolkata', ['en-US'])).toBe('IN');
    expect(radioCountry('Europe/Berlin', ['de-DE'])).toBe('DE');
    expect(radioCountry('America/New_York', ['en-US', 'en'])).toBe('IN');
    expect(radioCountry(undefined, ['en'])).toBe('IN');
  });
});

describe('favourite stations', () => {
  beforeEach(() => store.clear());
  const station = (n: number): RadioStation => ({ id: `s${n}`, name: `S${n}`, url: `https://s${n}.example` });

  it('stars and unstars', () => {
    toggleFavourite(station(1));
    toggleFavourite(station(2));
    expect(loadFavourites().map((s) => s.id)).toEqual(['s1', 's2']);
    toggleFavourite(station(1));
    expect(loadFavourites().map((s) => s.id)).toEqual(['s2']);
  });

  it(`keeps the last ${FAVOURITES_MAX} starred, and nothing saved wrong`, () => {
    for (let n = 0; n < FAVOURITES_MAX + 2; n++) toggleFavourite(station(n));
    expect(loadFavourites()).toHaveLength(FAVOURITES_MAX);
    expect(loadFavourites()[0]!.id).toBe('s2');
    store.set('ridecore.radioFavourites', JSON.stringify([station(1), { id: 'x', name: 'Bad', url: 'http://x' }]));
    expect(loadFavourites().map((s) => s.id)).toEqual(['s1']);
  });
});

describe('the radio player', () => {
  it("gives up on a station still silent after a while, and plays one that answers", async () => {
    vi.useFakeTimers();
    const players: FakeAudio[] = [];
    class FakeAudio {
      preload = '';
      src = '';
      private handlers = new Map<string, (() => void)[]>();
      constructor() {
        players.push(this);
      }
      addEventListener(type: string, handler: () => void) {
        this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
      }
      fire(type: string) {
        for (const handler of this.handlers.get(type) ?? []) handler();
      }
      getAttribute() {
        return this.src;
      }
      play() {
        return new Promise<void>(() => undefined);
      }
      pause() {
        this.fire('pause');
      }
    }
    vi.stubGlobal('Audio', FakeAudio);
    const { radio, TUNE_TIMEOUT_MS } = await import('./radio');
    const silent = { id: 'a', name: 'Silent', url: 'https://a.example' };
    radio.play(silent);
    expect(radio.getState().status).toBe('loading');
    vi.advanceTimersByTime(TUNE_TIMEOUT_MS + 1);
    expect(radio.getState()).toMatchObject({ status: 'error', error: "That station isn't answering" });

    radio.play({ id: 'b', name: 'Live', url: 'https://b.example' });
    players[0]!.fire('playing');
    vi.advanceTimersByTime(TUNE_TIMEOUT_MS + 1);
    expect(radio.getState()).toMatchObject({ status: 'playing', station: { id: 'b' } });
    vi.useRealTimers();
  });
});

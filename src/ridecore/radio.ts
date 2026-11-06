/**
 * Internet radio: stations from Radio Browser (radio-browser.info, an open directory, no
 * key), played in RIDECORE itself. Only HTTPS streams: the app is served over HTTPS and
 * Android blocks plain HTTP audio inside it. Favourites are kept on the phone.
 */

export interface RadioStation {
  /** Radio Browser's station id. */
  id: string;
  name: string;
  /** The stream itself. */
  url: string;
  /** The station's logo, HTTPS only. */
  favicon?: string;
  /** A word or two on what it plays: "bollywood, hindi". */
  tags?: string;
}

export type RadioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface RadioState {
  station: RadioStation | null;
  status: RadioStatus;
  error?: string;
}

const API = 'https://all.api.radio-browser.info/json';
const FAVOURITES_KEY = 'ridecore.radioFavourites';
/** A screenful of keys. */
export const FAVOURITES_MAX = 12;
const STATIONS_LIMIT = 80;
const FETCH_TIMEOUT_MS = 12_000;
/** A station still silent after this long has failed, rather than tuning in for ever. */
export const TUNE_TIMEOUT_MS = 15_000;

function https(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('https://') ? value : undefined;
}

/** Radio Browser's answer as stations: playable over HTTPS, each name once, in its order. */
export function parseStations(raw: unknown): RadioStation[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const stations: RadioStation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry.stationuuid === 'string' ? entry.stationuuid : '';
    const name = typeof entry.name === 'string' ? entry.name.replace(/\s+/g, ' ').trim() : '';
    const url = https(entry.url_resolved) ?? https(entry.url);
    if (!id || !name || !url) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const tags =
      typeof entry.tags === 'string'
        ? entry.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 2)
            .join(', ')
        : '';
    stations.push({ id, name, url, favicon: https(entry.favicon), tags: tags || undefined });
  }
  return stations;
}

/**
 * The country to list stations for: India by its time zone, else the phone's region, else
 * India (RIDECORE's riders are there, and many Indian phones are set to US English).
 */
export function radioCountry(timeZone?: string, languages: readonly string[] = []): string {
  if (timeZone === 'Asia/Kolkata' || timeZone === 'Asia/Calcutta') return 'IN';
  for (const language of languages) {
    const region = /^[a-z]{2,3}-([A-Z]{2})\b/.exec(language)?.[1];
    if (region && region !== 'US') return region;
  }
  return 'IN';
}

/** The country's most played stations, most played first. Needs a connection. */
export async function fetchStations(country: string): Promise<RadioStation[]> {
  const params = new URLSearchParams({
    countrycode: country,
    is_https: 'true',
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
    limit: String(STATIONS_LIMIT),
  });
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/stations/search?${params}`, { signal: abort.signal });
    if (!response.ok) throw new Error(`Radio stations: ${response.status}`);
    return parseStations(await response.json());
  } catch {
    throw new Error('Radio stations need a connection');
  } finally {
    clearTimeout(timer);
  }
}

function isStation(value: unknown): value is RadioStation {
  if (!value || typeof value !== 'object') return false;
  const station = value as Partial<RadioStation>;
  return typeof station.id === 'string' && typeof station.name === 'string' && typeof station.url === 'string' && station.url.startsWith('https://');
}

export function loadFavourites(): RadioStation[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter(isStation).slice(0, FAVOURITES_MAX) : [];
  } catch {
    return [];
  }
}

/** Starred, to the end of the favourites; starred again, gone. */
export function toggleFavourite(station: RadioStation): RadioStation[] {
  const list = loadFavourites();
  const next = list.some((s) => s.id === station.id)
    ? list.filter((s) => s.id !== station.id)
    : [...list, station].slice(-FAVOURITES_MAX);
  localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
  return next;
}

/**
 * The one radio: an audio element RIDECORE plays streams in. A live stream picked up
 * again starts from now, not from where it was paused.
 */
class RadioPlayer {
  private state: RadioState = { station: null, status: 'idle' };
  private listeners = new Set<() => void>();
  private audio: HTMLAudioElement | null = null;
  private tuneTimer: ReturnType<typeof setTimeout> | undefined;

  getState = (): RadioState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(next: RadioState): void {
    clearTimeout(this.tuneTimer);
    if (next.status === 'loading' && next.station) {
      const station = next.station;
      this.tuneTimer = setTimeout(() => {
        if (this.state.station?.id !== station.id || this.state.status !== 'loading') return;
        this.set({ station, status: 'error', error: "That station isn't answering" });
        this.audio?.pause();
      }, TUNE_TIMEOUT_MS);
    }
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  private element(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('playing', () => this.state.station && this.set({ station: this.state.station, status: 'playing' }));
    audio.addEventListener('waiting', () => this.state.station && this.set({ station: this.state.station, status: 'loading' }));
    audio.addEventListener('pause', () => {
      if (this.state.station && this.state.status !== 'error') this.set({ station: this.state.station, status: 'paused' });
    });
    audio.addEventListener('error', () => {
      if (!this.state.station || !audio.getAttribute('src')) return;
      this.set({ station: this.state.station, status: 'error', error: "That station isn't playing right now" });
    });
    this.audio = audio;
    return audio;
  }

  play(station: RadioStation): void {
    const audio = this.element();
    this.set({ station, status: 'loading' });
    audio.src = station.url;
    audio.play().catch((e: unknown) => {
      // A newer station took its place, or the pause came first.
      if (this.state.station?.id !== station.id || this.state.status !== 'loading') return;
      this.set({ station, status: 'error', error: e instanceof Error && e.name === 'NotAllowedError' ? 'Tap play to start the radio' : "That station isn't playing right now" });
    });
  }

  pause(): void {
    this.audio?.pause();
  }

  /** Playing: pause. Paused or failed: from now again. */
  toggle(): void {
    const { station, status } = this.state;
    if (!station) return;
    if (status === 'playing' || status === 'loading') this.pause();
    else this.play(station);
  }

  stop(): void {
    const audio = this.audio;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    this.set({ station: null, status: 'idle' });
  }
}

export const radio = new RadioPlayer();

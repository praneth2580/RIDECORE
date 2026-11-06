import { createTripStop, type Coordinate, type TripStop } from './engine';

/** A place ridden to from a search, so next time it's one tap instead of typing. */
export interface RecentPlace {
  name: string;
  /** The search's second line: the area, the city. */
  subtitle?: string;
  coordinate: Coordinate;
}

const RECENT_KEY = 'ridecore.recentPlaces';
/** Enough for home, work and a few more; a screenful of keys. */
export const RECENT_MAX = 6;
/** Closer than this, with the same name, it's the same place. */
const SAME_PLACE_DEG = 0.0005;

function isPlace(value: unknown): value is RecentPlace {
  if (!value || typeof value !== 'object') return false;
  const place = value as Partial<RecentPlace>;
  return (
    typeof place.name === 'string' &&
    Array.isArray(place.coordinate) &&
    place.coordinate.length >= 2 &&
    place.coordinate.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/** Newest first. */
export function loadRecentPlaces(): RecentPlace[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter(isPlace).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function samePlace(a: RecentPlace, b: RecentPlace): boolean {
  return (
    a.name === b.name &&
    Math.abs(a.coordinate[0] - b.coordinate[0]) < SAME_PLACE_DEG &&
    Math.abs(a.coordinate[1] - b.coordinate[1]) < SAME_PLACE_DEG
  );
}

function save(places: RecentPlace[]): RecentPlace[] {
  localStorage.setItem(RECENT_KEY, JSON.stringify(places));
  return places;
}

/** To the front, once: going there again moves it up instead of adding it twice. */
export function rememberPlace(place: RecentPlace): RecentPlace[] {
  const rest = loadRecentPlaces().filter((other) => !samePlace(other, place));
  return save([place, ...rest].slice(0, RECENT_MAX));
}

export function forgetPlace(place: RecentPlace): RecentPlace[] {
  return save(loadRecentPlaces().filter((other) => !samePlace(other, place)));
}

/** Where to go, as a trip's destination. */
export function stopFor(place: RecentPlace): TripStop {
  return createTripStop('destination', place.coordinate, place.name, place.subtitle);
}

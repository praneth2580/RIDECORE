/**
 * What the dash shows: the rider switches each part on or off in Settings (swiped down
 * from the dash). Whatever is off gives its room to the rest.
 */
export interface DashShows {
  /** The speedometer. */
  speed: boolean;
  /** The map. Turns still show without it. */
  map: boolean;
  /**
   * The dial right of the map in landscape, a line under it in portrait: the trip, the
   * ride, what plays, the weather or the time, tapped through (faces.ts).
   */
  trip: boolean;
  /** The "Where to?" button on the map when there's no trip. */
  whereTo: boolean;
  /** What plays, with its cover and keys, as one of that dial's faces. */
  music: boolean;
  /** The weather there, as one of that dial's faces. */
  weather: boolean;
  /** The top line's time and date. */
  clock: boolean;
  /** The top line's compass heading. */
  heading: boolean;
  /** The SIM's signal, Wi-Fi or offline: in a corner of the dash, else the top line. */
  network: boolean;
  /** GPS: in a corner of the dash, else the top line. */
  gps: boolean;
  /** A connected headset: in a corner of the dash, else the top line. */
  headset: boolean;
  /** The battery: in a corner of the dash, else the top line. */
  battery: boolean;
  /** The top line's temperature, with an umbrella when rain is likely. */
  topWeather: boolean;
  /** The screen's edge glowing on the side of the next turn as it comes (glow.ts). */
  turnGlow: boolean;
}

export const DASH_SHOWS_ALL: DashShows = {
  speed: true,
  map: true,
  trip: true,
  whereTo: true,
  music: true,
  weather: true,
  clock: true,
  heading: true,
  network: true,
  gps: true,
  headset: true,
  battery: true,
  topWeather: true,
  turnGlow: true,
};

const DASH_KEY = 'ridecore.dash';

/** As saved, with anything missing or unreadable shown. */
export function loadDashShows(): DashShows {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(DASH_KEY) ?? '{}');
    const shows = { ...DASH_SHOWS_ALL };
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(shows) as (keyof DashShows)[]) {
        const value = (saved as Record<string, unknown>)[key];
        if (typeof value === 'boolean') shows[key] = value;
      }
    }
    return shows;
  } catch {
    return { ...DASH_SHOWS_ALL };
  }
}

export function saveDashShows(shows: DashShows): void {
  localStorage.setItem(DASH_KEY, JSON.stringify(shows));
}

import type { LiveRide, RideRecord } from './engine';

/**
 * The ride recorder in words and numbers, for the Rides screen (Recorder, RidesPage).
 */

/** Under this, an average speed is mostly the first few metres' noise. */
export const AVERAGE_AFTER_SECONDS = 30;
export const AVERAGE_AFTER_METERS = 100;

/** What the recorder is doing, in a few words: the line under the screen's name. */
export function recorderLine(ride: LiveRide | null, autoRecord: boolean): { text: string; live: boolean } {
  if (ride?.state === 'recording') return { text: ride.auto ? 'Recording with navigation' : 'Recording', live: true };
  if (ride?.state === 'paused') return { text: 'Paused', live: false };
  return { text: autoRecord ? 'Auto-record on' : 'Not recording', live: false };
}

/** Under the face while recording: how a ride ends. */
export function recorderNote(ride: LiveRide | null): string | null {
  if (ride?.state !== 'recording') return null;
  return ride.auto ? 'Saves itself when the trip ends' : 'Pause to save or discard';
}

/** km/h over the time recorded so far, pauses left out; null until there's enough to go on. */
export function averageKmh(distanceMeters: number, seconds: number): number | null {
  if (!(seconds >= AVERAGE_AFTER_SECONDS) || !(distanceMeters >= AVERAGE_AFTER_METERS)) return null;
  return Math.round((distanceMeters / seconds) * 3.6);
}

/** Every ride kept, added up. */
export function rideTotals(rides: readonly Pick<RideRecord, 'distanceMeters'>[]): { count: number; meters: number } {
  return { count: rides.length, meters: rides.reduce((sum, ride) => sum + (ride.distanceMeters > 0 ? ride.distanceMeters : 0), 0) };
}

/** A past ride's top speed, or null when the GPS never gave one. */
export function topKmh(ride: Pick<RideRecord, 'maxSpeedMps'>): number | null {
  const kmh = Math.round(ride.maxSpeedMps * 3.6);
  return kmh > 0 ? kmh : null;
}

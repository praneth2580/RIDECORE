/**
 * The dash's right dial (a line under the road in portrait) shows one face at a time:
 * the trip, the ride, what plays, the lean (with the handlebar module's IMU), the
 * weather, or the time. A tap steps to the next
 * face there is; the one picked stays. Something starting shows itself: a trip always,
 * a ride or music unless a trip is under way. A face that goes (the music stopped)
 * hands over to the first there is, in this order.
 */
import { useEffect, useRef, useState } from 'react';

export const FACES = ['trip', 'ride', 'music', 'lean', 'weather', 'clock'] as const;
export type Face = (typeof FACES)[number];

const FACE_KEY = 'ridecore.dashFace';

/** What the dash has to show right now. */
export interface FaceSignals {
  /** A trip under way, paused or going. */
  trip: boolean;
  /** A ride being recorded. */
  ride: boolean;
  /** Something to play or pause, on the phone or the radio. */
  music: boolean;
  /** It plays, or the radio is tuning in. */
  musicPlaying: boolean;
  /** The module's IMU sending. */
  lean: boolean;
  weather: boolean;
}

/** The faces there are, in order; the time always. */
export function availableFaces(signals: FaceSignals): Face[] {
  return FACES.filter((face) => face === 'clock' || signals[face]);
}

/** The face picked, while it's there; else the first there is. */
export function shownFace(available: Face[], picked: Face | null): Face {
  return picked && available.includes(picked) ? picked : (available[0] ?? 'clock');
}

/** The face after this one, back round to the first. */
export function nextFace(available: Face[], shown: Face): Face {
  const at = available.indexOf(shown);
  return available[(at + 1) % available.length] ?? 'clock';
}

/** The face that just started and shows itself; null if nothing did. */
export function takeover(before: FaceSignals, now: FaceSignals): Face | null {
  if (now.trip && !before.trip) return 'trip';
  if (now.trip) return null;
  if (now.ride && !before.ride) return 'ride';
  if (now.musicPlaying && !before.musicPlaying) return 'music';
  return null;
}

function loadPicked(): Face | null {
  try {
    const saved = localStorage.getItem(FACE_KEY);
    return FACES.find((face) => face === saved) ?? null;
  } catch {
    return null;
  }
}

function savePicked(face: Face): void {
  try {
    localStorage.setItem(FACE_KEY, face);
  } catch {
    // Kept for this run only.
  }
}

const stepListeners = new Set<() => void>();

/** Steps the dial to its next face, as a tap on it does: for a handlebar button. */
export function requestNextFace(): void {
  for (const listener of stepListeners) listener();
}

/** The face to show, the faces there are, and a tap's step to the next. */
export function useDashFace(signals: FaceSignals): { face: Face; available: Face[]; next: () => void } {
  const [picked, setPicked] = useState(loadPicked);
  const before = useRef(signals);
  const available = availableFaces(signals);
  const face = shownFace(available, picked);

  const { trip, ride, music, musicPlaying, lean, weather } = signals;
  useEffect(() => {
    const now = { trip, ride, music, musicPlaying, lean, weather };
    const started = takeover(before.current, now);
    before.current = now;
    if (started) {
      savePicked(started);
      setPicked(started);
    }
  }, [trip, ride, music, musicPlaying, lean, weather]);

  const next = () => {
    const to = nextFace(available, face);
    savePicked(to);
    setPicked(to);
  };

  // A handlebar button asking for the next face.
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });
  useEffect(() => {
    const step = () => nextRef.current();
    stepListeners.add(step);
    return () => {
      stepListeners.delete(step);
    };
  }, []);

  return { face, available, next };
}

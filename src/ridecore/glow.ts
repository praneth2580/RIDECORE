import type { ManeuverKind } from './engine';

/**
 * The edge glow for the next turn: the side of the screen the turn goes to lights up as
 * it comes, so it's seen from the corner of the eye without reading anything. Left-hand
 * traffic (India): a U-turn goes round to the right. Arriving lights both sides green.
 */
export interface TurnGlow {
  side: 'left' | 'right' | 'both';
  /** 0–1: faint when it starts, full at the turn. */
  strength: number;
  /** Turn now: it pulses. */
  urgent: boolean;
  /** Arriving rather than turning. */
  arrive: boolean;
}

/** The glow starts this many seconds before the turn at the rider's speed… */
export const GLOW_LEAD_SECONDS = 12;
/** …but no closer than this (slow, or no speed known), and no further. */
export const GLOW_MIN_START_M = 150;
export const GLOW_MAX_START_M = 500;
/** This close, or this few seconds away, it pulses. */
const NOW_M = 35;
const NOW_SECONDS = 3;
/** Where it starts, from nothing: enough to be seen. */
const FIRST_STRENGTH = 0.3;
/** A slight turn or keeping to a side needs less: a softer glow. */
const SLIGHT_WEIGHT = 0.65;

function sideOf(kind: ManeuverKind): TurnGlow['side'] | null {
  if (kind === 'arrive') return 'both';
  if (kind === 'uturn' || kind.endsWith('right')) return 'right';
  if (kind.endsWith('left')) return 'left';
  return null;
}

/** The glow for the next turn this far ahead at this speed; null when there's none. */
export function turnGlow(kind: ManeuverKind | null, distanceMeters: number | null, speedMps: number | null): TurnGlow | null {
  if (!kind || distanceMeters == null || !Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  const side = sideOf(kind);
  if (!side) return null;
  const speed = speedMps != null && Number.isFinite(speedMps) ? Math.max(0, speedMps) : 0;
  const start = Math.min(GLOW_MAX_START_M, Math.max(GLOW_MIN_START_M, speed * GLOW_LEAD_SECONDS));
  if (distanceMeters > start) return null;
  const closeness = 1 - distanceMeters / start;
  const weight = kind.startsWith('slight') ? SLIGHT_WEIGHT : 1;
  return {
    side,
    strength: Math.round(weight * (FIRST_STRENGTH + (1 - FIRST_STRENGTH) * closeness) * 100) / 100,
    urgent: distanceMeters <= Math.max(NOW_M, speed * NOW_SECONDS),
    arrive: kind === 'arrive',
  };
}

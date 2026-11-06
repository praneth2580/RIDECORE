/**
 * TrailCompass's navigation display maths, with RIDECORE's zoom by speed.
 *
 * TrailCompass zooms for a map that fills the phone. RIDECORE's map is the middle of
 * the device, under half that height, so the same zoom showed too little road ahead.
 * How far it zooms out with speed is the rider's choice (Settings → On the dash →
 * Speed zoom). Everything else is TrailCompass's own, re-exported, so its changes keep
 * arriving.
 */
import { navigationZoomForSpeed as fullScreenZoom } from '../../../services/nav-display';

export * from '../../../services/nav-display';

/** How much further out than TrailCompass: about the share of the screen the map gets. */
export const ZOOM_OUT = 1.3;
/** Never further out than this, however fast and whatever the multiplier. */
export const FARTHEST_ZOOM = 11;

/** How strongly speed zooms the map out: 1 is TrailCompass's curve. */
let zoomMultiplier = 1;

export function getZoomMultiplier(): number {
  return zoomMultiplier;
}

export function setZoomMultiplier(multiplier: number): void {
  if (Number.isFinite(multiplier) && multiplier >= 0) zoomMultiplier = multiplier;
}

/**
 * Zoom by speed (m/s): TrailCompass's curve, pulled back for a smaller map. Standing
 * still is the same at any multiplier; the multiplier scales how far it zooms out.
 */
export function navigationZoomForSpeed(speedMps: number | null | undefined): number {
  const still = fullScreenZoom(0);
  const zoomedOut = (still - fullScreenZoom(speedMps)) * zoomMultiplier;
  return Math.max(FARTHEST_ZOOM, still - zoomedOut - ZOOM_OUT);
}

/**
 * TrailCompass's navigation display maths, with RIDECORE's navigation zoom.
 *
 * TrailCompass zooms for a map that fills the phone. RIDECORE's map is the middle of
 * the device, under half that height, so the same zoom showed too little road ahead.
 * Everything else is TrailCompass's own, re-exported, so its changes keep arriving.
 */
import { navigationZoomForSpeed as fullScreenZoom } from '../../../services/nav-display';

export * from '../../../services/nav-display';

/** How much further out than TrailCompass: about the share of the screen the map gets. */
export const ZOOM_OUT = 1.3;

/** Navigation zoom by speed (m/s): TrailCompass's curve, pulled back for a smaller map. */
export function navigationZoomForSpeed(speedMps: number | null | undefined): number {
  return fullScreenZoom(speedMps) - ZOOM_OUT;
}

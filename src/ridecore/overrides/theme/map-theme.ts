/**
 * TrailCompass's src/theme/map-theme.ts, with RIDECORE's colours under the env
 * (src/ridecore/map-theme.ts). Otherwise the same: resolved once, when the app is built.
 */
import { resolveRidecoreMapTheme } from '../../map-theme';
import type { MapTheme } from '../../../theme/map-theme-core';

export type { MapTheme } from '../../../theme/map-theme-core';

const resolved = resolveRidecoreMapTheme(import.meta.env);
for (const problem of resolved.problems) console.warn(`[map theme] ${problem}`);

export const mapTheme: MapTheme = resolved.theme;

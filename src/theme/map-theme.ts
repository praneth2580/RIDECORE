import { resolveMapTheme, type MapTheme } from './map-theme-core';

export type { MapTheme } from './map-theme-core';

/**
 * This build's map colours, from its env (see map-theme-core.ts). Fixed
 * when the app is built: change the env and rebuild, or restart the dev server.
 */
const resolved = resolveMapTheme(import.meta.env);
for (const problem of resolved.problems) console.warn(`[map theme] ${problem}`);

export const mapTheme: MapTheme = resolved.theme;

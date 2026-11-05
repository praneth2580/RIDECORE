/**
 * RIDECORE's map colours, through TrailCompass's map theme (src/theme/map-theme-core.ts).
 * TrailCompass's "dark" preset underneath, RIDECORE's colours over it, and a build's
 * own env (VITE_MAP_THEME, VITE_MAP_THEME_JSON, VITE_MAP_COLOR_*) over both.
 * Used by src/ridecore/overrides/theme/map-theme.ts.
 */
import { resolveMapTheme, type MapThemeOverrides, type ResolvedMapTheme } from '../theme/map-theme-core';

/** The device's look on the map: neutral black, the route in the dashboard's green, the rider in lime. */
export const RIDECORE_MAP_THEME: MapThemeOverrides = {
  basemap: {
    background: '#0d0e10',
    landuse: '#121316',
    park: '#122019',
    water: '#0a1824',
    building: '#1b1c20',
    motorway: '#70737a',
    majorRoad: '#4b4e55',
    minorRoad: '#2f3238',
    roadCasing: '#060708',
    path: '#2a2d32',
    rail: '#3a3d43',
    boundary: '#55585f',
    label: '#c8cad0',
    waterLabel: '#6c93b5',
    labelHalo: '#060708',
  },
  route: {
    active: '#5fd04a',
    passed: '#4b4e55',
    recalculating: '#3f8a33',
    previous: '#55605a',
    recalcLink: '#ff453a',
    alternatives: ['#20a1fa', '#716cf7', '#a3a4a9'],
  },
  ride: { recording: '#ff453a', past: '#716cf7' },
  traffic: { casing: '#000000' },
  places: { fuel: '#20a1fa', food: '#e07a5f', icon: '#ffffff', label: '#c8cad0', labelHalo: '#060708' },
  markers: {
    rider: '#dffe45',
    riderOutline: '#000000',
    destination: '#ffffff',
    stop: '#a3a4a9',
    outline: '#000000',
    glyph: '#dffe45',
  },
};

/** RIDECORE's map theme under a build's env: anything set there still wins. */
export function resolveRidecoreMapTheme(env: Record<string, unknown>): ResolvedMapTheme {
  return resolveMapTheme({
    VITE_MAP_THEME: 'dark',
    VITE_MAP_THEME_JSON: JSON.stringify(RIDECORE_MAP_THEME),
    ...env,
  });
}

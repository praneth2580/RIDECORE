import { describe, expect, it } from 'vitest';
import { MAP_THEME_PRESETS, resolveMapTheme } from '../theme/map-theme-core';
import { RIDECORE_MAP_THEME, resolveRidecoreMapTheme } from './map-theme';

describe("RIDECORE's map theme", () => {
  it('is all valid colours', () => {
    expect(resolveRidecoreMapTheme({}).problems).toEqual([]);
  });

  it('sets every basemap colour the dark preset does, so none of its tint shows', () => {
    expect(Object.keys(RIDECORE_MAP_THEME.basemap!).sort()).toEqual(Object.keys(MAP_THEME_PRESETS.dark!.basemap!).sort());
  });

  it("is RIDECORE's colours over TrailCompass's dark preset", () => {
    const { theme } = resolveRidecoreMapTheme({});
    expect(theme.route.active).toBe('#5fd04a');
    expect(theme.markers.rider).toBe('#dffe45');
    expect(theme.basemap.background).toBe('#0d0e10');
    // Colours RIDECORE leaves alone are the dark preset's.
    expect(theme.traffic.clear).toBe(resolveMapTheme({ VITE_MAP_THEME: 'dark' }).theme.traffic.clear);
  });

  it("lets a build's env win", () => {
    const { theme, problems } = resolveRidecoreMapTheme({ VITE_MAP_COLOR_ROUTE_ACTIVE: '#e63946' });
    expect(problems).toEqual([]);
    expect(theme.route.active).toBe('#e63946');
    expect(theme.markers.rider).toBe('#dffe45');
  });
});

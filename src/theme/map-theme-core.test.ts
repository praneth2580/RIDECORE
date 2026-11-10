// MapLibre's own colour parser, to hold isMapColor to it. It comes with maplibre-gl.
import { Color } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import libertyStyle from '../offline/liberty-style.json';
import {
  applyBasemapTheme,
  BASEMAP_TOKENS,
  DEFAULT_MAP_THEME,
  isMapColor,
  MAP_THEME_PRESETS,
  mapColorEnvName,
  NAMED_COLORS,
  resolveMapTheme,
  splitColorList,
  type ThemeableStyle,
} from './map-theme-core';

type Layer = { id: string; paint?: Record<string, unknown> };

function liberty(): ThemeableStyle & { layers: Layer[] } {
  return structuredClone(libertyStyle) as unknown as ThemeableStyle & { layers: Layer[] };
}

function paintOf(style: { layers: Layer[] }, id: string): Record<string, unknown> {
  const layer = style.layers.find((l) => l.id === id);
  if (!layer?.paint) throw new Error(`no layer ${id}`);
  return layer.paint;
}

describe('resolveMapTheme', () => {
  it('gives the default theme for an empty env', () => {
    const { theme, problems } = resolveMapTheme({});
    expect(problems).toEqual([]);
    expect(theme).toEqual(DEFAULT_MAP_THEME);
    // A copy: the app can't change the defaults.
    theme.route.alternatives.push('red');
    expect(DEFAULT_MAP_THEME.route.alternatives).toHaveLength(3);
  });

  it('keeps the colours the app had before themes', () => {
    const { route, ride, traffic, places, markers, basemap } = DEFAULT_MAP_THEME;
    expect(route).toEqual({
      active: '#F5A623',
      passed: '#8b939c',
      recalculating: '#c47d10',
      previous: '#8fa698',
      recalcLink: '#ff6b4a',
      alternatives: ['#5b8def', '#9b7bff', '#3dbea5'],
    });
    expect(ride).toEqual({ recording: '#ff5a5f', past: '#b28dff' });
    expect(traffic.clear).toBe('#0ca30c');
    expect(places.fuel).toBe('#3dbea5');
    expect(markers.rider).toBe('#3b8ef0');
    expect(basemap).toEqual({});
  });

  it.each(Object.keys(MAP_THEME_PRESETS))('resolves the "%s" preset cleanly', (name) => {
    const { problems } = resolveMapTheme({ VITE_MAP_THEME: name });
    expect(problems).toEqual([]);
  });

  it('lays a preset over the defaults', () => {
    const { theme } = resolveMapTheme({ VITE_MAP_THEME: 'dark' });
    expect(theme.basemap.background).toBe(MAP_THEME_PRESETS.dark!.basemap!.background);
    expect(theme.route.active).toBe(DEFAULT_MAP_THEME.route.active);
  });

  it('reports an unknown preset and uses the default', () => {
    const { theme, problems } = resolveMapTheme({ VITE_MAP_THEME: 'neon' });
    expect(theme).toEqual(DEFAULT_MAP_THEME);
    expect(problems).toEqual([expect.stringContaining('no preset "neon" (there are default, dark')]);
  });

  it('takes any part of a theme as JSON, over the preset', () => {
    const { theme, problems } = resolveMapTheme({
      VITE_MAP_THEME: 'dark',
      VITE_MAP_THEME_JSON: JSON.stringify({
        route: { active: '#e63946', alternatives: ['red', 'rgb(0, 128, 255)'] },
        basemap: { water: 'hsl(205, 60%, 70%)' },
      }),
    });
    expect(problems).toEqual([]);
    expect(theme.route.active).toBe('#e63946');
    expect(theme.route.passed).toBe(MAP_THEME_PRESETS.dark!.route!.passed);
    expect(theme.route.alternatives).toEqual(['red', 'rgb(0, 128, 255)']);
    expect(theme.basemap.water).toBe('hsl(205, 60%, 70%)');
    expect(theme.basemap.background).toBe(MAP_THEME_PRESETS.dark!.basemap!.background);
  });

  it('takes single colours over JSON', () => {
    const { theme, problems } = resolveMapTheme({
      VITE_MAP_THEME_JSON: '{"route":{"active":"#e63946"}}',
      VITE_MAP_COLOR_ROUTE_ACTIVE: ' #00ff88 ',
      VITE_MAP_COLOR_BASEMAP_MAJOR_ROAD: 'white',
      VITE_MAP_COLOR_MARKERS_RIDER_OUTLINE: '#000',
      VITE_MAP_COLOR_ROUTE_ALTERNATIVES: '#5b8def, rgba(155, 123, 255, 0.8),teal',
    });
    expect(problems).toEqual([]);
    expect(theme.route.active).toBe('#00ff88');
    expect(theme.basemap.majorRoad).toBe('white');
    expect(theme.markers.riderOutline).toBe('#000');
    expect(theme.route.alternatives).toEqual(['#5b8def', 'rgba(155, 123, 255, 0.8)', 'teal']);
  });

  it('names a variable for every colour', () => {
    expect(mapColorEnvName('route', 'recalcLink')).toBe('VITE_MAP_COLOR_ROUTE_RECALC_LINK');
    expect(mapColorEnvName('basemap', 'labelHalo')).toBe('VITE_MAP_COLOR_BASEMAP_LABEL_HALO');
    expect(mapColorEnvName('structures', 'bridgeCasing')).toBe('VITE_MAP_COLOR_STRUCTURES_BRIDGE_CASING');
    for (const token of BASEMAP_TOKENS) {
      const { theme } = resolveMapTheme({ [mapColorEnvName('basemap', token)]: 'red' });
      expect(theme.basemap[token]).toBe('red');
    }
  });

  it('skips what MapLibre could not draw, and says why', () => {
    const { theme, problems } = resolveMapTheme({
      VITE_MAP_THEME_JSON: JSON.stringify({
        route: { active: '#12345', speed: '#fff', alternatives: [] },
        roads: { minor: '#fff' },
        ride: 'red',
      }),
      VITE_MAP_COLOR_TRAFFIC_CLEAR: 'grean',
      VITE_MAP_COLOR_ROUTE_ACTVE: '#fff',
      VITE_MAP_COLOR_ROUTE_ALTERNATIVES: '#fff, nope',
    });
    expect(theme).toEqual(DEFAULT_MAP_THEME);
    expect(problems).toEqual([
      'VITE_MAP_THEME_JSON route.active: "#12345" is not a colour MapLibre can read, ignored',
      expect.stringContaining('VITE_MAP_THEME_JSON route.speed: "route" has no colour "speed"'),
      'VITE_MAP_THEME_JSON route.alternatives: expected a list of colours, got [], ignored',
      expect.stringContaining('VITE_MAP_THEME_JSON: no colour group "roads"'),
      'VITE_MAP_THEME_JSON ride: expected an object of colours, ignored',
      'VITE_MAP_COLOR_ROUTE_ALTERNATIVES: expected a list of colours, got ["#fff","nope"], ignored',
      'VITE_MAP_COLOR_TRAFFIC_CLEAR: "grean" is not a colour MapLibre can read, ignored',
      'VITE_MAP_COLOR_ROUTE_ACTVE: not a map theme setting, ignored',
    ]);
  });

  it('explains values a .env file cut short at an unquoted #', () => {
    // `VITE_MAP_COLOR_ROUTE_ACTIVE=#e63946` reads as "", and JSON stops at its first #.
    const { problems } = resolveMapTheme({
      VITE_MAP_COLOR_ROUTE_ACTIVE: '',
      VITE_MAP_THEME_JSON: '{"route":{"active":"',
    });
    expect(problems).toEqual([
      expect.stringMatching(/^VITE_MAP_THEME_JSON: not valid JSON.*single quotes/),
      expect.stringMatching(/^VITE_MAP_COLOR_ROUTE_ACTIVE: empty.*quote colours/),
    ]);
  });

  it('leaves the rest of the env alone', () => {
    const { problems } = resolveMapTheme({ VITE_MAP_TILES: 'x', VITE_OTHER: '#zz', PATH: '/bin', MODE: 'test' });
    expect(problems).toEqual([]);
  });
});

describe('splitColorList', () => {
  it('splits on commas outside brackets', () => {
    expect(splitColorList('#5b8def, hsl(10, 20%, 30%) ,rgb(1 2 3 / 50%),')).toEqual([
      '#5b8def',
      'hsl(10, 20%, 30%)',
      'rgb(1 2 3 / 50%)',
    ]);
    expect(splitColorList('  ')).toEqual([]);
  });
});

describe('isMapColor', () => {
  const samples = [
    '#abc', '#ABCD', '#a1b2c3', '#a1b2c3d4', '#12345', '#ggg', 'abc', '#',
    'red', 'RED', ' Teal ', 'rebeccapurple', 'grean', 'transparent', 'currentcolor', 'none',
    'rgb(1,2,3)', 'rgba(1, 2, 3, 0.5)', 'rgb(1 2 3)', 'rgb(1 2 3 / 50%)', 'rgb(10%,20%,30%)',
    'rgb(10%,20,30%)', 'rgb(1,2 3)', 'rgb(1 2 3, 0.5)', 'rgb(1,2,3 / 0.5)', 'rgb(1e,2,3)',
    'rgba(255,255,255,1.5)', 'rgb(-1,300,2)', 'rgb()', 'rgb(1,2)',
    'hsl(10,20%,30%)', 'hsla(10, 20%, 30%, .5)', 'hsl(10deg 20% 30%)', 'hsl(10 20% 30% / 40%)',
    'hsl(10,20,30)', 'hsl(10turn,20%,30%)', 'hsl(+-1,20%,30%)',
    'oklch(70% 0.1 200)', 'color-mix(in srgb, red, blue)', 'var(--x)', '', '  ',
  ];

  it.each(samples)('reads %j as MapLibre does', (sample) => {
    expect(isMapColor(sample)).toBe(Color.parse(sample) !== undefined);
  });

  it("knows MapLibre's colour names, all 148 of CSS Color 4", () => {
    expect(NAMED_COLORS.size).toBe(148);
    const unknown = [...NAMED_COLORS].filter((name) => Color.parse(name) === undefined);
    expect(unknown).toEqual([]);
    for (const name of ['bluish', 'darkred1', 'light-blue']) expect(isMapColor(name)).toBe(false);
  });

  it('only takes strings', () => {
    expect(isMapColor(0xff0000)).toBe(false);
    expect(isMapColor(['red'])).toBe(false);
    expect(isMapColor(null)).toBe(false);
  });
});

describe('applyBasemapTheme', () => {
  it('leaves Liberty as it is with no basemap colours', () => {
    const style = liberty();
    applyBasemapTheme(style, {});
    expect(style).toEqual(libertyStyle);
  });

  // Catches a newer Liberty renaming the layers a colour is meant for.
  it.each(BASEMAP_TOKENS)('paints some of Liberty with "%s"', (token) => {
    const style = liberty();
    applyBasemapTheme(style, { [token]: '#123456' });
    const painted = style.layers.filter((layer) =>
      Object.values(layer.paint ?? {}).includes('#123456'),
    );
    expect(painted.length).toBeGreaterThan(0);
  });

  it('recolours the layers each colour is for', () => {
    const style = liberty();
    applyBasemapTheme(style, {
      background: '#101010',
      water: '#202020',
      majorRoad: '#303030',
      roadCasing: '#404040',
      label: '#505050',
      labelHalo: '#606060',
    });
    expect(paintOf(style, 'background')['background-color']).toBe('#101010');
    expect(paintOf(style, 'water')['fill-color']).toBe('#202020');
    expect(paintOf(style, 'waterway_river')['line-color']).toBe('#202020');
    expect(paintOf(style, 'road_trunk_primary')['line-color']).toBe('#303030');
    expect(paintOf(style, 'bridge_secondary_tertiary')['line-color']).toBe('#303030');
    expect(paintOf(style, 'road_trunk_primary_casing')['line-color']).toBe('#404040');
    expect(paintOf(style, 'label_city')['text-color']).toBe('#505050');
    expect(paintOf(style, 'label_city')['text-halo-color']).toBe('#606060');
    // Not other families.
    expect(paintOf(style, 'road_motorway')['line-color']).toEqual(paintOf(liberty(), 'road_motorway')['line-color']);
    expect(paintOf(style, 'water_name_point_label')['text-color']).toBe('#495e91');
  });

  it("never adds a property a layer didn't have", () => {
    const style = liberty();
    applyBasemapTheme(style, { labelHalo: '#606060' });
    expect(paintOf(style, 'highway-name-minor')).not.toHaveProperty('text-halo-color');
  });
});

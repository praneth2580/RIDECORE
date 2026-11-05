/**
 * The map's colours: the route, the lines, pins and places drawn over the
 * basemap, and, when a theme sets them, the basemap's own colours.
 *
 * A build picks its theme from Vite env variables (`.env.local` or the
 * shell), each one over the one before:
 *
 * 1. `VITE_MAP_THEME`: a preset by name (`MAP_THEME_PRESETS`: `default`, `dark`).
 * 2. `VITE_MAP_THEME_JSON`: any part of a theme as JSON,
 *    e.g. `{"route":{"active":"#e63946"},"basemap":{"water":"#9ec5e8"}}`.
 * 3. `VITE_MAP_COLOR_<GROUP>_<NAME>`: one colour. `route.active` is
 *    `VITE_MAP_COLOR_ROUTE_ACTIVE`, `basemap.majorRoad` is
 *    `VITE_MAP_COLOR_BASEMAP_MAJOR_ROAD` (`mapColorEnvName`).
 *
 * A value MapLibre can't read is reported and skipped, so the colour under
 * it stays. `npm run build` stops on one and the dev server warns
 * (vite.config.ts); in the app it is a console warning (map-theme.ts).
 *
 * No DOM and no `import.meta` here: vite.config.ts runs this in Node.
 */

export interface MapTheme {
  /** The planned route. */
  route: {
    /** The route on offer or being followed. */
    active: string;
    /** The part of it already ridden. */
    passed: string;
    /** The route, dashed, while a new one is worked out. */
    recalculating: string;
    /** The route before a reroute, dashed, until the new one arrives. */
    previous: string;
    /** The dashed line from the rider to the destination while rerouting. */
    recalcLink: string;
    /** Each route option in turn, and the swatch on its button. */
    alternatives: string[];
  };
  /** Recorded tracks. */
  ride: {
    /** The ride being recorded. */
    recording: string;
    /** A past ride opened from the ride log. */
    past: string;
  };
  /** A route by its usual traffic (Library → Rides → Routes), on the map and in its legends. */
  traffic: {
    clear: string;
    moderate: string;
    slow: string;
    jammed: string;
    /** Parts without enough rides to tell. */
    none: string;
    /** The outline under the coloured line. */
    casing: string;
  };
  /** Fuel stations and places to eat. */
  places: {
    /** Fuel icons and fuel stop pins. */
    fuel: string;
    /** Food icons and food stop pins. */
    food: string;
    /** The pump or cutlery drawn on an icon. */
    icon: string;
    /** Place names. */
    label: string;
    labelHalo: string;
  };
  markers: {
    /** The GPS dot and the navigation arrow. */
    rider: string;
    riderOutline: string;
    destination: string;
    /** A stop dropped on the map (fuel and food stops take `places`). */
    stop: string;
    /** The edge of pins and place icons, and the disc in a pin. */
    outline: string;
    /** The dot or letter in a pin's disc. */
    glyph: string;
  };
  /** The basemap. Unset colours keep OpenFreeMap Liberty's own. */
  basemap: BasemapTheme;
}

/** The basemap's colours, each covering a family of Liberty's layers (BASEMAP_TARGETS). */
export const BASEMAP_TOKENS = [
  'background',
  'landuse',
  'park',
  'water',
  'building',
  'motorway',
  'majorRoad',
  'minorRoad',
  'roadCasing',
  'path',
  'rail',
  'boundary',
  'label',
  'waterLabel',
  'labelHalo',
] as const;

export type BasemapToken = (typeof BASEMAP_TOKENS)[number];
export type BasemapTheme = Partial<Record<BasemapToken, string>>;

/** Any part of a theme, laid over another. */
export type MapThemeOverrides = { [G in keyof MapTheme]?: Partial<MapTheme[G]> };

/** The app's colours, over OpenFreeMap Liberty as it comes. */
export const DEFAULT_MAP_THEME: MapTheme = {
  route: {
    active: '#F5A623',
    passed: '#8b939c',
    recalculating: '#c47d10',
    previous: '#8fa698',
    recalcLink: '#ff6b4a',
    alternatives: ['#5b8def', '#9b7bff', '#3dbea5'],
  },
  ride: {
    recording: '#ff5a5f',
    past: '#b28dff',
  },
  traffic: {
    clear: '#0ca30c',
    moderate: '#fab219',
    slow: '#ec835a',
    jammed: '#d03b3b',
    none: '#8b939c',
    // Dark, so yellow and orange stand out on the pale map.
    casing: '#1d1d1d',
  },
  places: {
    fuel: '#3dbea5',
    food: '#e07a5f',
    icon: '#ffffff',
    label: '#3b3b3b',
    labelHalo: '#ffffff',
  },
  markers: {
    rider: '#3b8ef0',
    riderOutline: '#ffffff',
    destination: '#f0a020',
    stop: '#7b8cff',
    outline: '#1a1205',
    glyph: '#f5f0e6',
  },
  basemap: {},
};

/**
 * Themes picked by name with `VITE_MAP_THEME`. Add one here to offer it;
 * it is laid over DEFAULT_MAP_THEME, so it only needs what it changes.
 */
export const MAP_THEME_PRESETS: Record<string, MapThemeOverrides> = {
  default: {},
  /** A dark basemap, like the app around it: easier on the eyes at night. */
  dark: {
    basemap: {
      background: '#0f1a16',
      landuse: '#13201b',
      park: '#16291f',
      water: '#0c2433',
      building: '#1c2924',
      motorway: '#7a8a82',
      majorRoad: '#5a6962',
      minorRoad: '#3a4741',
      roadCasing: '#0a120f',
      path: '#33413a',
      rail: '#4a5852',
      boundary: '#6b7f75',
      label: '#d3ded8',
      waterLabel: '#7fb0d6',
      labelHalo: '#0a120f',
    },
    route: { passed: '#66707a' },
    places: { label: '#e6ece8', labelHalo: '#0a120f' },
    traffic: { casing: '#000000' },
  },
};

export const MAP_THEME_ENV = 'VITE_MAP_THEME';
export const MAP_THEME_JSON_ENV = 'VITE_MAP_THEME_JSON';
const COLOR_ENV_PREFIX = 'VITE_MAP_COLOR_';

const GROUPS = Object.keys(DEFAULT_MAP_THEME) as Array<keyof MapTheme>;

/** `route.recalcLink` is set by `VITE_MAP_COLOR_ROUTE_RECALC_LINK`. */
export function mapColorEnvName(group: keyof MapTheme, name: string): string {
  return `${COLOR_ENV_PREFIX}${group}_${name.replace(/[A-Z]/g, (c) => `_${c}`)}`.toUpperCase();
}

export interface ResolvedMapTheme {
  theme: MapTheme;
  /** What was wrong with the env, one line each; those values were skipped. */
  problems: string[];
}

/** The theme a build's env asks for (see the top of this file). */
export function resolveMapTheme(env: Record<string, unknown>): ResolvedMapTheme {
  const theme = structuredClone(DEFAULT_MAP_THEME);
  const problems: string[] = [];

  const presetName = envText(env[MAP_THEME_ENV]) || 'default';
  const preset = Object.hasOwn(MAP_THEME_PRESETS, presetName)
    ? MAP_THEME_PRESETS[presetName]
    : undefined;
  if (preset) {
    applyOverrides(theme, preset, `preset "${presetName}"`, problems);
  } else {
    const names = Object.keys(MAP_THEME_PRESETS).join(', ');
    problems.push(`${MAP_THEME_ENV}: no preset "${presetName}" (there are ${names}), used "default"`);
  }

  if (env[MAP_THEME_JSON_ENV] !== undefined) {
    let overrides: unknown;
    try {
      overrides = JSON.parse(envText(env[MAP_THEME_JSON_ENV]));
    } catch {
      problems.push(
        `${MAP_THEME_JSON_ENV}: not valid JSON, ignored. In a .env file, wrap it in single quotes: an unquoted # starts a comment`,
      );
    }
    if (overrides !== undefined) applyOverrides(theme, overrides, MAP_THEME_JSON_ENV, problems);
  }

  const known = new Set([MAP_THEME_ENV, MAP_THEME_JSON_ENV]);
  for (const group of GROUPS) {
    for (const name of colorNames(group)) {
      const variable = mapColorEnvName(group, name);
      known.add(variable);
      if (env[variable] === undefined) continue;
      const text = envText(env[variable]);
      setColor(theme, group, name, name === 'alternatives' ? splitColorList(text) : text, variable, problems);
    }
  }
  for (const variable of Object.keys(env)) {
    const ours = variable.startsWith(COLOR_ENV_PREFIX) || variable.startsWith(MAP_THEME_ENV);
    if (ours && !known.has(variable)) problems.push(`${variable}: not a map theme setting, ignored`);
  }

  return { theme, problems };
}

function applyOverrides(theme: MapTheme, overrides: unknown, source: string, problems: string[]): void {
  if (!isRecord(overrides)) {
    problems.push(`${source}: expected an object such as {"route":{"active":"#e63946"}}, ignored`);
    return;
  }
  for (const [group, colors] of Object.entries(overrides)) {
    if (!isGroup(group)) {
      problems.push(`${source}: no colour group "${group}" (there are ${GROUPS.join(', ')}), ignored`);
    } else if (!isRecord(colors)) {
      problems.push(`${source} ${group}: expected an object of colours, ignored`);
    } else {
      for (const [name, value] of Object.entries(colors)) {
        setColor(theme, group, name, value, `${source} ${group}.${name}`, problems);
      }
    }
  }
}

function setColor(
  theme: MapTheme,
  group: keyof MapTheme,
  name: string,
  value: unknown,
  where: string,
  problems: string[],
): void {
  const names = colorNames(group);
  if (!names.includes(name)) {
    problems.push(`${where}: "${group}" has no colour "${name}" (it has ${names.join(', ')}), ignored`);
    return;
  }
  if (group === 'route' && name === 'alternatives') {
    if (!Array.isArray(value) || value.length === 0 || !value.every(isMapColor)) {
      problems.push(`${where}: expected a list of colours, got ${JSON.stringify(value)}, ignored`);
      return;
    }
    theme.route.alternatives = value.map((color) => color.trim());
    return;
  }
  if (!isMapColor(value)) {
    problems.push(
      value === ''
        ? `${where}: empty, ignored. In a .env file, quote colours ("#e63946"): an unquoted # starts a comment`
        : `${where}: ${JSON.stringify(value)} is not a colour MapLibre can read, ignored`,
    );
    return;
  }
  (theme[group] as Record<string, unknown>)[name] = value.trim();
}

function colorNames(group: keyof MapTheme): readonly string[] {
  return group === 'basemap' ? BASEMAP_TOKENS : Object.keys(DEFAULT_MAP_THEME[group]);
}

function isGroup(name: string): name is keyof MapTheme {
  return (GROUPS as string[]).includes(name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function envText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** "#5b8def, rgb(155, 123, 255)" → both colours: commas inside brackets don't split. */
export function splitColorList(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * Which of Liberty's layers each basemap colour paints, and which of their
 * colour properties. Only properties a layer already sets are changed, so a
 * theme never adds outlines or halos Liberty doesn't draw.
 */
const BASEMAP_TARGETS: Record<BasemapToken, { layers: RegExp; paint: string[] }> = {
  background: { layers: /^background$/, paint: ['background-color'] },
  landuse: {
    layers: /^(landuse_\w+|landcover_(ice|sand)|aeroway_fill)$/,
    paint: ['fill-color'],
  },
  park: {
    layers: /^(park|park_outline|landcover_(wood|grass))$/,
    paint: ['fill-color', 'fill-outline-color', 'line-color'],
  },
  water: {
    layers: /^(water|waterway_(tunnel|river|other))$/,
    paint: ['fill-color', 'line-color'],
  },
  building: {
    layers: /^building(-3d)?$/,
    paint: ['fill-color', 'fill-outline-color', 'fill-extrusion-color'],
  },
  motorway: { layers: /^(road|tunnel|bridge)_motorway(_link)?$/, paint: ['line-color'] },
  majorRoad: {
    layers: /^(road|tunnel|bridge)_(trunk_primary|secondary_tertiary|link)$/,
    paint: ['line-color'],
  },
  minorRoad: {
    layers: /^((road|tunnel)_minor|bridge_street|(road|tunnel|bridge)_service_track|aeroway_(runway|taxiway))$/,
    paint: ['line-color'],
  },
  roadCasing: { layers: /_casing$/, paint: ['line-color'] },
  path: { layers: /_path_pedestrian$/, paint: ['line-color'] },
  rail: { layers: /_rail(_hatching)?$/, paint: ['line-color'] },
  boundary: { layers: /^boundary_/, paint: ['line-color'] },
  label: { layers: /^(label_|poi_|highway-name-|airport$)/, paint: ['text-color'] },
  waterLabel: { layers: /^(waterway_line_label|water_name_)/, paint: ['text-color'] },
  labelHalo: {
    layers: /^(label_|poi_|highway-name-|airport$|waterway_line_label|water_name_)/,
    paint: ['text-halo-color'],
  },
};

/** Enough of a MapLibre style to recolour. */
export interface ThemeableStyle {
  layers: Array<{ id: string; paint?: object }>;
}

/** Paints the basemap colours a theme sets onto Liberty's layers, in place. */
export function applyBasemapTheme(style: ThemeableStyle, basemap: BasemapTheme): void {
  for (const token of BASEMAP_TOKENS) {
    const color = basemap[token];
    if (!color) continue;
    const { layers, paint } = BASEMAP_TARGETS[token];
    for (const layer of style.layers) {
      if (!layers.test(layer.id) || !layer.paint) continue;
      const props = layer.paint as Record<string, unknown>;
      for (const prop of paint) {
        if (prop in props) props[prop] = color;
      }
    }
  }
}

/** The CSS colour names MapLibre knows (CSS Color 4). */
export const NAMED_COLORS: ReadonlySet<string> = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet ' +
    'brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue ' +
    'darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange ' +
    'darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise ' +
    'darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen ' +
    'fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred ' +
    'indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
    'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta ' +
    'maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
    'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin ' +
    'navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen ' +
    'paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red ' +
    'rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue ' +
    'slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
    'whitesmoke yellow yellowgreen'
  ).split(' '),
);

const HEX = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/;
// MapLibre's own grammar (parseCssColor in @maplibre/maplibre-gl-style-spec):
// comma- or space-separated, alpha after a comma or a slash.
const RGB =
  /^rgba?\(\s*([\de.+-]+)(%)?(?:\s+|\s*(,)\s*)([\de.+-]+)(%)?(?:\s+|\s*(,)\s*)([\de.+-]+)(%)?(?:\s*([,/])\s*([\de.+-]+)%?)?\s*\)$/;
const HSL =
  /^hsla?\(\s*([\de.+-]+)(?:deg)?(?:\s+|\s*(,)\s*)([\de.+-]+)%(?:\s+|\s*(,)\s*)([\de.+-]+)%(?:\s*([,/])\s*([\de.+-]+)%?)?\s*\)$/;
/** All spaces, all commas, or spaces with a slash before the alpha. */
const SEPARATORS = new Set(['  ', '  /', ',,', ',,,']);

/**
 * Whether MapLibre reads `value` as a colour: a CSS name, `transparent`,
 * hex, or rgb()/rgba()/hsl()/hsla(). The theme tests check this against
 * MapLibre's own parser.
 */
export function isMapColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const color = value.trim().toLowerCase();
  if (color === 'transparent' || NAMED_COLORS.has(color) || HEX.test(color)) return true;
  const rgb = RGB.exec(color);
  if (rgb) {
    const [, r, rp, f1, g, gp, f2, b, bp, f3, a] = rgb;
    const percents = [rp, gp, bp].filter(Boolean).length;
    // Every channel a percentage, or none.
    return separatorsOk(f1, f2, f3) && (percents === 0 || percents === 3) && numbers(r, g, b, a);
  }
  const hsl = HSL.exec(color);
  if (hsl) {
    const [, h, f1, s, f2, l, f3, a] = hsl;
    return separatorsOk(f1, f2, f3) && numbers(h, s, l, a);
  }
  return false;
}

function separatorsOk(f1?: string, f2?: string, f3?: string): boolean {
  return SEPARATORS.has(`${f1 || ' '}${f2 || ' '}${f3 ?? ''}`);
}

/** The grammar lets through things like "1e" or "+-1"; MapLibre rejects them as NaN. */
function numbers(...values: Array<string | undefined>): boolean {
  return values.every((value) => value === undefined || !Number.isNaN(Number(value)));
}

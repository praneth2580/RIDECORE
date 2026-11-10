import type {
  ExpressionSpecification,
  LayerSpecification,
  LineLayerSpecification,
} from 'maplibre-gl';
import type { MapTheme } from '../theme/map-theme-core';

/**
 * Makes bridges and tunnels readable on Liberty. As it comes, a flyover is
 * drawn exactly like the road beside and under it, and a tunnel only a
 * shade paler, so at a junction nothing says which road is up and which is
 * down. Here bridges get dark, wider edges and a soft shadow, and tunnels
 * dashed edges.
 */

/** Liberty's road kinds in its bridge_* / tunnel_* layer ids (not rail, paths or waterways). */
const ROAD = '(motorway|motorway_link|trunk_primary|secondary_tertiary|link|street|minor|service_track)';
const BRIDGE_CASING = new RegExp(`^bridge_${ROAD}_casing$`);
const TUNNEL_CASING = new RegExp(`^tunnel_${ROAD}_casing$`);

export const BRIDGE_SHADOW_LAYER = 'bridge_shadow';
/** Bridge edges this much wider than Liberty's, so the dark rim shows past the road's fill. */
const BRIDGE_CASING_SCALE = 1.3;
/** OSM Bright's tunnel dashes, in line widths. */
const TUNNEL_DASHES = [0.5, 0.25];

const MAJOR: ExpressionSpecification = ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false];
const MIDDLE: ExpressionSpecification = ['match', ['get', 'class'], ['secondary', 'tertiary'], true, false];

/** Enough of a MapLibre style to restyle. */
export interface StructureStyleTarget {
  layers: LayerSpecification[];
}

/** Restyles `style`'s bridges and tunnels in place. Call after the basemap theme. */
export function emphasizeStructures(
  style: StructureStyleTarget,
  colors: Pick<MapTheme['structures'], 'bridgeCasing' | 'bridgeShadow'>,
): void {
  for (const layer of style.layers) {
    if (layer.type !== 'line') continue;
    const paint = (layer.paint ??= {});
    if (BRIDGE_CASING.test(layer.id)) {
      paint['line-color'] = colors.bridgeCasing;
      if (paint['line-width'] != null) {
        paint['line-width'] = scaleOutputs(paint['line-width'], BRIDGE_CASING_SCALE) as typeof paint['line-width'];
      }
    } else if (TUNNEL_CASING.test(layer.id)) {
      paint['line-dasharray'] = TUNNEL_DASHES;
    }
  }

  // Under every bridge layer, so it falls on whatever the bridge crosses.
  const firstBridge = style.layers.findIndex((l) => l.id.startsWith('bridge_'));
  if (firstBridge < 0 || style.layers.some((l) => l.id === BRIDGE_SHADOW_LAYER)) return;
  style.layers.splice(firstBridge, 0, bridgeShadowLayer(colors.bridgeShadow));
}

function bridgeShadowLayer(color: string): LineLayerSpecification {
  // Roughly each kind's widened casing plus room for the blur.
  const width = (major: number, middle: number, minor: number): ExpressionSpecification => [
    'case',
    MAJOR,
    major,
    MIDDLE,
    middle,
    minor,
  ];
  return {
    id: BRIDGE_SHADOW_LAYER,
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    minzoom: 13,
    filter: [
      'all',
      ['==', ['get', 'brunnel'], 'bridge'],
      [
        'match',
        ['get', 'class'],
        ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track'],
        true,
        false,
      ],
    ],
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': color,
      'line-width': [
        'interpolate',
        ['exponential', 1.2],
        ['zoom'],
        13,
        width(9, 7, 2),
        16,
        width(16, 12, 13),
        20,
        width(32, 25, 35),
      ],
      'line-blur': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 4],
      // Same way on screen however the map turns: one light source.
      'line-translate': [2, 3],
      'line-translate-anchor': 'viewport',
    },
  };
}

/**
 * A width scaled by `factor`: a number, or the outputs of a zoom
 * `interpolate` / `step` (a zoom curve can't be wrapped in a `*`).
 */
export function scaleOutputs(value: unknown, factor: number): unknown {
  if (typeof value === 'number') return value * factor;
  if (!Array.isArray(value)) return value;
  const [op] = value;
  // interpolate: [op, how, input, stop, out, stop, out…]; step: [op, input, out, stop, out…]
  const firstOutput = op === 'interpolate' ? 4 : op === 'step' ? 2 : -1;
  if (firstOutput < 0) return value;
  return value.map((part, i) =>
    i >= firstOutput && (i - firstOutput) % 2 === 0 && typeof part === 'number' ? part * factor : part,
  );
}

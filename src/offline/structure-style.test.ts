import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import libertyStyle from './liberty-style.json';
import { BRIDGE_SHADOW_LAYER, emphasizeStructures, scaleOutputs } from './structure-style';
import { DEFAULT_MAP_THEME } from '../theme/map-theme-core';

function liberty(): StyleSpecification {
  return structuredClone(libertyStyle) as unknown as StyleSpecification;
}

function layer(style: StyleSpecification, id: string): LayerSpecification & { paint: Record<string, unknown> } {
  const found = style.layers.find((l) => l.id === id);
  if (!found) throw new Error(`no layer ${id}`);
  return found as LayerSpecification & { paint: Record<string, unknown> };
}

const colors = DEFAULT_MAP_THEME.structures;

describe('emphasizeStructures', () => {
  it('gives road bridges dark, wider edges', () => {
    const before = liberty();
    const style = liberty();
    emphasizeStructures(style, colors);
    for (const id of ['bridge_trunk_primary_casing', 'bridge_street_casing', 'bridge_motorway_casing']) {
      expect(layer(style, id).paint['line-color']).toBe(colors.bridgeCasing);
      expect(layer(style, id).paint['line-width']).toEqual(
        scaleOutputs(layer(before, id).paint['line-width'], 1.3),
      );
    }
    // Railway bridges and footbridges keep Liberty's look.
    expect(layer(style, 'bridge_major_rail')).toEqual(layer(before, 'bridge_major_rail'));
    expect(layer(style, 'bridge_path_pedestrian_casing')).toEqual(layer(before, 'bridge_path_pedestrian_casing'));
  });

  it('dashes the edges of road tunnels', () => {
    const style = liberty();
    emphasizeStructures(style, colors);
    expect(layer(style, 'tunnel_trunk_primary_casing').paint['line-dasharray']).toEqual([0.5, 0.25]);
    expect(layer(style, 'tunnel_street_casing').paint['line-dasharray']).toEqual([0.5, 0.25]);
    expect(layer(style, 'tunnel_trunk_primary').paint['line-dasharray']).toBeUndefined();
  });

  it('casts a shadow under every bridge layer, once', () => {
    const style = liberty();
    emphasizeStructures(style, colors);
    emphasizeStructures(style, colors);
    const ids = style.layers.map((l) => l.id);
    expect(ids.filter((id) => id === BRIDGE_SHADOW_LAYER)).toHaveLength(1);
    expect(ids.indexOf(BRIDGE_SHADOW_LAYER)).toBe(ids.findIndex((id) => id.startsWith('bridge_') && id !== BRIDGE_SHADOW_LAYER) - 1);
    expect(layer(style, BRIDGE_SHADOW_LAYER).paint['line-color']).toBe(colors.bridgeShadow);
  });

  it('leaves a style MapLibre accepts', () => {
    const style = liberty();
    emphasizeStructures(style, colors);
    expect(validateStyleMin(style)).toEqual([]);
  });
});

describe('scaleOutputs', () => {
  it('scales a number or the outputs of a zoom curve, never its stops', () => {
    expect(scaleOutputs(4, 1.5)).toBe(6);
    expect(scaleOutputs(['interpolate', ['exponential', 1.2], ['zoom'], 12, 2, 20, 10], 2)).toEqual([
      'interpolate', ['exponential', 1.2], ['zoom'], 12, 4, 20, 20,
    ]);
    expect(scaleOutputs(['step', ['zoom'], 1, 14, 3], 2)).toEqual(['step', ['zoom'], 2, 14, 6]);
    expect(scaleOutputs(['get', 'width'], 2)).toEqual(['get', 'width']);
  });
});

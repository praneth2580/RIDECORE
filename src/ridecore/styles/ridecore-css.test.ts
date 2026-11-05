import mapLibreCss from 'maplibre-gl/dist/maplibre-gl.css?raw';
import { describe, expect, it } from 'vitest';
import ridecoreCss from './ridecore.css?raw';

/** Every MapLibre selector a stylesheet has, spaced the same way. */
function mapLibreSelectors(css: string): Set<string> {
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g);
  return new Set(
    [...selectors]
      .flatMap((match) => match[1]!.split(','))
      .map((selector) => selector.replace(/\s*([+>])\s*/g, '$1').replace(/\s+/g, ' ').trim())
      .filter((selector) => selector.includes('maplibregl')),
  );
}

describe('ridecore.css', () => {
  // Same trap as src/index-css.test.ts: a rule with one of MapLibre's own selectors
  // gets merged with MapLibre's by the minifier, and only production shows it.
  it('never styles MapLibre with one of its own selectors', () => {
    const ours = mapLibreSelectors(ridecoreCss);
    const shared = [...mapLibreSelectors(mapLibreCss)].filter((selector) => ours.has(selector));
    expect(shared).toEqual([]);
  });
});

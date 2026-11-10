import { describe, expect, it } from 'vitest';
import type { CalculatedRoute } from './routing-adapter';
import { mergeRoutes } from './route-merge';

const leg = (from: number, structures?: CalculatedRoute['structures']): CalculatedRoute => ({
  coordinates: [[from, 0], [from + 1, 0]],
  distanceMeters: 100,
  durationSeconds: 10,
  instructions: [],
  ...(structures ? { structures } : {}),
});

describe('mergeRoutes', () => {
  it("keeps every leg's bridges and tunnels, in order", () => {
    const bridge = { kind: 'bridge' as const, label: 'Flyover', coordinates: [[0.2, 0], [0.4, 0]] as CalculatedRoute['coordinates'] };
    const tunnel = { kind: 'tunnel' as const, coordinates: [[1.5, 0], [1.6, 0]] as CalculatedRoute['coordinates'] };
    const merged = mergeRoutes([leg(0, [bridge]), leg(1), leg(2, [tunnel])]);
    expect(merged.structures).toEqual([bridge, tunnel]);
    expect(merged.coordinates).toHaveLength(4);
  });

  it("measures every leg's signals from the start of the whole route", () => {
    const merged = mergeRoutes([
      { ...leg(0), signals: [{ coordinate: [0.5, 0], alongMeters: 40 }] },
      { ...leg(1), signals: [{ coordinate: [1.2, 0], alongMeters: 20 }, { coordinate: [1.8, 0], alongMeters: 80 }] },
    ]);
    expect(merged.signals?.map((s) => s.alongMeters)).toEqual([40, 120, 180]);
  });

  it('adds none when no leg has any', () => {
    expect(mergeRoutes([leg(0), leg(1)])).not.toHaveProperty('structures');
    expect(mergeRoutes([leg(0), leg(1)])).not.toHaveProperty('signals');
  });
});

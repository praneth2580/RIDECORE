import { describe, expect, it } from 'vitest';
import { parseRouteFile, serializeRouteFile } from './route-file';
import type { SavedRoute } from '../types/route';

function trip(places?: unknown): SavedRoute {
  return {
    id: 'konkan',
    name: 'Konkan coast',
    createdAt: '2026-10-24T09:00:00Z',
    updatedAt: '2026-10-24T09:00:00Z',
    start: [72.85, 19.17],
    end: [73.27, 17.15],
    waypoints: [[73.42, 18.08], [73.52, 17.53]],
    coordinates: [[72.85, 19.17], [73.42, 18.08], [73.52, 17.53], [73.27, 17.15]],
    distanceMeters: 331_000,
    durationSeconds: 26_700,
    instructions: [],
    ...(places ? { places: places as SavedRoute['places'] } : {}),
  };
}

const named = {
  end: 'Ganpatipule',
  endNotes: 'Ratnagiri, Maharashtra',
  stops: [
    { name: 'Mahad', kind: 'manual', notes: 'Raigad, Maharashtra' },
    { name: 'HP Petrol Pump, Chiplun', kind: 'fuel' },
  ],
};

describe('route files keep stop names', () => {
  it('reads back the names of the destination and stops', () => {
    expect(parseRouteFile(serializeRouteFile(trip(named))).places).toEqual(named);
  });

  it('drops stop names that no longer match the stops', () => {
    const places = parseRouteFile(
      serializeRouteFile(trip({ ...named, stops: named.stops.slice(0, 1) })),
    ).places;
    expect(places).toEqual({ end: 'Ganpatipule', endNotes: 'Ratnagiri, Maharashtra' });
  });

  it('ignores names of an unknown kind or shape', () => {
    const odd = { end: 42, stops: [{ name: 'A', kind: 'rocket' }, { name: 'B', kind: 'fuel' }] };
    expect(parseRouteFile(serializeRouteFile(trip(odd))).places).toBeUndefined();
  });

  it('reads older files without names', () => {
    expect(parseRouteFile(serializeRouteFile(trip())).places).toBeUndefined();
  });
});

describe('route files keep bridges and tunnels', () => {
  const structures = [
    { kind: 'bridge', label: 'Sion Flyover', coordinates: [[72.86, 19.04], [72.87, 19.04]] },
    { kind: 'tunnel', coordinates: [[73.3, 18.7], [73.31, 18.71]] },
  ];

  it('reads them back', () => {
    const saved = { ...trip(), structures } as SavedRoute;
    expect(parseRouteFile(serializeRouteFile(saved)).structures).toEqual(structures);
  });

  it('drops malformed ones and reads older files without any', () => {
    const odd = [
      ...structures,
      { kind: 'ferry', coordinates: [[0, 0], [1, 1]] },
      { kind: 'bridge', coordinates: [[0, 0]] },
      { kind: 'bridge', coordinates: [[0, 0], ['x', 1]] },
    ];
    const saved = { ...trip(), structures: odd } as unknown as SavedRoute;
    expect(parseRouteFile(serializeRouteFile(saved)).structures).toEqual(structures);
    expect(parseRouteFile(serializeRouteFile(trip())).structures).toBeUndefined();
  });
});

describe('route files keep traffic signals', () => {
  const signals = [
    { coordinate: [72.86, 19.12], alongMeters: 2_670 },
    { coordinate: [72.87, 19.11], alongMeters: 4_120 },
  ];

  it('reads them back, dropping malformed ones', () => {
    const odd = [...signals, { coordinate: [72.8], alongMeters: 10 }, { coordinate: [72.8, 19.1], alongMeters: 'far' }];
    const saved = { ...trip(), signals: odd } as unknown as SavedRoute;
    expect(parseRouteFile(serializeRouteFile(saved)).signals).toEqual(signals);
    expect(parseRouteFile(serializeRouteFile(trip())).signals).toBeUndefined();
  });
});

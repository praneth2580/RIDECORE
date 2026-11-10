import { describe, expect, it } from 'vitest';
import type { Coordinate } from './routing-adapter';
import {
  OfflineGraphEngine,
  type NetworkFeatureCollection,
} from './graph-engine';
import type { NetworkControl, RoadTags } from './road-attributes';
import { forkCue, routeStructures, type BranchStep } from './structure-guidance';
import { maneuverKind } from './turn-instructions';

// Near the equator 0.00001° is about 1.1 m.

function network(
  features: Array<{ highway: string; coordinates: Coordinate[]; tags?: RoadTags; name?: string }>,
  controls: NetworkControl[] = [],
): NetworkFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.map((f, i) => ({
      type: 'Feature',
      properties: { highway: f.highway, osm_id: i + 1, tags: f.tags, name: f.name ?? null },
      geometry: { type: 'LineString', coordinates: f.coordinates },
    })),
    controls,
  };
}

/**
 * Riding east on a one-way primary road. At F (x = 0.002) it forks: a ramp
 * rises to the left onto a ~330 m flyover over a signal junction, and the
 * service road carries on beside and under it, through that signal. Both
 * meet again at M. A side street leaves the service road at J, under the
 * flyover.
 */
const F: Coordinate = [0.002, 0];
const J: Coordinate = [0.0045, -0.0001];
const M: Coordinate = [0.0075, 0];
const oneway = { oneway: 'yes' };
const flyoverJunction = (bridgeTags: RoadTags = {}, rampName?: string) =>
  network(
    [
      { highway: 'primary', coordinates: [[0, 0], F], tags: oneway },
      // Ramp up (not a bridge yet), the flyover, the ramp down.
      { highway: 'primary', coordinates: [F, [0.0026, 0.00008]], tags: oneway, name: rampName },
      {
        highway: 'primary',
        coordinates: [[0.0026, 0.00008], [0.0045, 0.0001], [0.0059, 0.00008]],
        tags: { ...oneway, bridge: 'yes', layer: '1', ...bridgeTags },
      },
      { highway: 'primary', coordinates: [[0.0059, 0.00008], M], tags: oneway },
      // Service road below, with the junction's signal at J.
      { highway: 'primary', coordinates: [F, [0.0026, -0.0001], J, [0.006, -0.0001], M], tags: oneway },
      { highway: 'residential', coordinates: [J, [0.0045, -0.003]] },
      { highway: 'primary', coordinates: [M, [0.01, 0]], tags: oneway },
    ],
    [{ coordinate: J, kind: 'traffic_signals' }],
  );

function routeThrough(collection: NetworkFeatureCollection, end: Coordinate) {
  const engine = new OfflineGraphEngine();
  engine.loadFeatureCollection(collection);
  return engine.calculateRoute([0, 0], end, { alternatives: 1 });
}

describe('flyover guidance on a planned route', () => {
  it('says to bear onto the flyover when the route takes it', () => {
    const route = routeThrough(flyoverJunction(), [0.01, 0]);
    const fork = route.instructions[0]!;
    expect(fork.text).toBe('Keep left to take the flyover');
    expect(fork.structure).toEqual({ kind: 'bridge', action: 'take', term: 'flyover' });
    // The fork is ~222 m along the road.
    expect(fork.distanceMeters).toBeGreaterThan(215);
    expect(fork.distanceMeters).toBeLessThan(230);
    expect(maneuverKind(fork)).toBe('slight-left');
    expect(route.structures).toEqual([
      expect.objectContaining({ kind: 'bridge', label: 'Flyover' }),
    ]);
    expect(route.structures![0]!.coordinates[0]).toEqual([0.0026, 0.00008]);
  });

  it('says to stay below it when the route turns off under it', () => {
    const route = routeThrough(flyoverJunction(), [0.0045, -0.003]);
    expect(route.instructions[0]!.text).toBe('Keep right to stay below the flyover');
    expect(route.instructions[0]!.structure).toEqual({ kind: 'bridge', action: 'below', term: 'flyover' });
    expect(route.instructions[1]!.structure).toBeUndefined();
    expect(maneuverKind(route.instructions[0]!)).toBe('slight-right');
    // Then the turn at the junction under the flyover.
    expect(route.instructions[1]!.text).toBe('Turn right');
    expect(route.structures ?? []).toEqual([]);
  });

  it('uses the flyover’s own name', () => {
    const named = routeThrough(flyoverJunction({ 'bridge:name': 'Sion Flyover' }), [0.01, 0]);
    expect(named.instructions[0]!.text).toBe('Keep left to take Sion Flyover');
    expect(named.structures![0]!.label).toBe('Sion Flyover');

    const below = routeThrough(flyoverJunction({ 'bridge:name': 'Sion Flyover' }), [0.0045, -0.003]);
    expect(below.instructions[0]!.text).toBe('Keep right to stay below Sion Flyover');
  });

  it('sees past a short connector onto the service road', () => {
    // As OSM maps the Andheri Flyover: the road below is reached by a 12 m
    // link heading off square, then turns to run beside the flyover.
    const north = { oneway: 'yes' };
    const fork: Coordinate = [0, 0.002];
    const link: Coordinate = [-0.00011, 0.002];
    const route = routeThrough(
      network([
        { highway: 'primary', coordinates: [[0, 0], fork], tags: north },
        { highway: 'primary', coordinates: [fork, [0, 0.0025]], tags: north },
        { highway: 'primary', coordinates: [[0, 0.0025], [0, 0.006]], tags: { ...north, bridge: 'yes' } },
        { highway: 'primary', coordinates: [[0, 0.006], [0, 0.008]], tags: north },
        { highway: 'primary_link', coordinates: [fork, link], tags: north },
        { highway: 'primary', coordinates: [[-0.00011, -0.002], link, [-0.00011, 0.007]] },
      ]),
      [0, 0.008],
    );
    expect(route.instructions[0]!.text).toBe('Keep right to take the flyover');
  });

  it('gives no cue where the roads ahead are the same', () => {
    const flat = network([
      { highway: 'primary', coordinates: [[0, 0], F], tags: oneway },
      { highway: 'primary', coordinates: [F, [0.0026, 0.00008], [0.006, 0.0001]], tags: oneway },
      { highway: 'primary', coordinates: [F, [0.0026, -0.0001], [0.006, -0.0001]], tags: oneway },
    ]);
    const route = routeThrough(flat, [0.006, 0.0001]);
    expect(route.instructions.map((i) => i.text)).toEqual(['Head toward destination', 'Arrive at destination']);
  });
});

/** A straight branch from the fork, `meters` long, then optionally more steps. */
function branch(bearingDeg: number, parts: Array<{ meters: number; structure?: 'bridge' | 'tunnel'; name?: string }>): BranchStep[] {
  const steps: BranchStep[] = [];
  let at: Coordinate = [0, 0];
  const rad = (bearingDeg * Math.PI) / 180;
  for (const part of parts) {
    const deg = part.meters / 111_320;
    const next: Coordinate = [at[0] + Math.sin(rad) * deg, at[1] + Math.cos(rad) * deg];
    steps.push({ structure: part.structure ?? null, structureName: part.name ?? null, geometry: [at, next] });
    at = next;
  }
  return steps;
}

const ground: BranchStep = { structure: null, structureName: null, geometry: [[0, -0.001], [0, 0]] };
const onFlyover: BranchStep = { structure: 'bridge', structureName: null, geometry: [[0, -0.001], [0, 0]] };

describe('forkCue', () => {
  it('calls a bridge that heads off elsewhere a bridge, not a flyover', () => {
    const cue = forkCue(ground, branch(30, [{ meters: 60 }, { meters: 200, structure: 'bridge' }]), [
      branch(-10, [{ meters: 300 }]),
    ]);
    expect(cue).toMatchObject({
      side: 'right',
      purpose: 'take the bridge',
      structure: { kind: 'bridge', action: 'take', term: 'bridge' },
      labelStep: 1,
    });
    const skip = forkCue(ground, branch(-10, [{ meters: 300 }]), [
      branch(30, [{ meters: 60 }, { meters: 200, structure: 'bridge' }]),
    ]);
    expect(skip).toMatchObject({ side: 'left', purpose: 'avoid the bridge', structure: { action: 'avoid' } });
  });

  it('handles underpasses', () => {
    const take = forkCue(ground, branch(2, [{ meters: 50 }, { meters: 150, structure: 'tunnel' }, { meters: 100 }]), [
      branch(-2, [{ meters: 300 }]),
    ]);
    expect(take).toMatchObject({
      side: 'right',
      purpose: 'take the underpass',
      structure: { kind: 'tunnel', action: 'take', term: 'underpass' },
    });
    const avoid = forkCue(ground, branch(-2, [{ meters: 300 }]), [
      branch(2, [{ meters: 50 }, { meters: 150, structure: 'tunnel', name: 'Milan Subway' }]),
    ]);
    expect(avoid).toMatchObject({
      side: 'left',
      purpose: 'avoid Milan Subway',
      structure: { kind: 'tunnel', action: 'avoid', term: 'underpass' },
    });
  });

  it('says which way off a flyover: down the ramp or on along it', () => {
    const along = branch(0, [{ meters: 300, structure: 'bridge' }]);
    const ramp = branch(15, [{ meters: 120, structure: 'bridge' }, { meters: 180 }]);
    expect(forkCue(onFlyover, ramp, [along])).toMatchObject({
      side: 'right',
      purpose: 'exit the flyover',
      structure: { kind: 'bridge', action: 'exit' },
      labelStep: -1,
    });
    expect(forkCue(onFlyover, along, [ramp])).toMatchObject({
      side: 'left',
      purpose: 'stay on the flyover',
      structure: { kind: 'bridge', action: 'stay' },
    });
    // Both come down within the lookahead: nothing to tell apart.
    expect(forkCue(onFlyover, branch(0, [{ meters: 100, structure: 'bridge' }, { meters: 200 }]), [ramp])).toBeNull();
  });

  it('names no side when the route runs between two branches that differ', () => {
    const cue = forkCue(ground, branch(0, [{ meters: 300 }]), [
      branch(-8, [{ meters: 40 }, { meters: 260, structure: 'bridge' }]),
      branch(8, [{ meters: 40 }, { meters: 260, structure: 'bridge' }]),
    ]);
    expect(cue).toMatchObject({ side: null, purpose: 'stay below the flyover', structure: { action: 'below' } });
  });

  it('leaves real turns to the turn instructions', () => {
    expect(
      forkCue(ground, branch(0, [{ meters: 300 }]), [branch(80, [{ meters: 40 }, { meters: 200, structure: 'bridge' }])]),
    ).toBeNull();
  });
});

describe('routeStructures', () => {
  const steps = [
    ...branch(90, [{ meters: 50 }]),
    ...branch(90, [{ meters: 30, structure: 'bridge' }]),
    ...branch(90, [{ meters: 80, structure: 'bridge' }]),
    ...branch(90, [{ meters: 50 }]),
    ...branch(90, [{ meters: 140, structure: 'tunnel' }]),
    ...branch(90, [{ meters: 40, structure: 'bridge', name: 'Nala Bridge' }]),
    ...branch(90, [{ meters: 20, structure: 'bridge' }]),
  ];

  it('joins a stretch’s steps and labels it by name, cue, or length', () => {
    const out = routeStructures(steps, new Map([[2, 'flyover']]));
    expect(out.map((s) => [s.kind, s.label, s.coordinates.length])).toEqual([
      ['bridge', 'Flyover', 3],
      ['tunnel', 'Tunnel', 2],
      ['bridge', 'Nala Bridge', 3],
    ]);
  });

  it('leaves short unnamed ones unlabelled', () => {
    const out = routeStructures(branch(0, [{ meters: 50 }, { meters: 60, structure: 'bridge' }]));
    expect(out).toHaveLength(1);
    expect(out[0]!.label).toBeUndefined();
  });
});

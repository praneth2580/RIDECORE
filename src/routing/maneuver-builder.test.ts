import { describe, expect, it } from 'vitest';
import type { Coordinate } from './routing-adapter';
import { buildManeuversFromPath, type PathCue } from './maneuver-builder';

// East along the equator, then a fork at index 2.
const straight: Coordinate[] = [[0, 0], [0.001, 0], [0.002, 0], [0.002 + 0.001, 0.00005], [0.004, 0.0001]];
const turning: Coordinate[] = [[0, 0], [0.001, 0], [0.002, 0], [0.002, 0.001], [0.002, 0.002]];

describe('buildManeuversFromPath cues', () => {
  it('adds a keep-side maneuver where the path barely bends', () => {
    const cues = new Map<number, PathCue>([[2, { side: 'right', purpose: 'take the flyover' }]]);
    const plain = buildManeuversFromPath(straight);
    expect(plain.map((i) => i.text)).toEqual(['Head toward destination', 'Arrive at destination']);

    const [fork, arrive] = buildManeuversFromPath(straight, cues);
    expect(fork).toMatchObject({ text: 'Keep right to take the flyover', maneuver: 'depart' });
    expect(fork!.distanceMeters).toBeCloseTo(222.6, 0);
    expect(arrive!.maneuver).toBe('arrive');
  });

  it('carries what the cue is about onto the instruction', () => {
    const structure = { kind: 'bridge' as const, action: 'take' as const, term: 'flyover' };
    const cues = new Map<number, PathCue>([[2, { side: 'right', purpose: 'take the flyover', structure }]]);
    const [fork, arrive] = buildManeuversFromPath(straight, cues);
    expect(fork!.structure).toEqual(structure);
    expect(arrive!.structure).toBeUndefined();
  });

  it('keeps the turn when the path turns there anyway', () => {
    const cues = new Map<number, PathCue>([[2, { side: 'right', purpose: 'stay below the flyover' }]]);
    expect(buildManeuversFromPath(turning, cues)[0]!.text).toBe('Turn left to stay below the flyover');
  });

  it('says what to do when no side can be told', () => {
    const cues = new Map<number, PathCue>([[2, { side: null, purpose: 'stay below the flyover' }]]);
    expect(buildManeuversFromPath(straight, cues)[0]!.text).toBe('Stay below the flyover');
  });

  it('keeps a cue right after a turn', () => {
    // A left turn at index 2, then the flyover fork 6 m on.
    const path: Coordinate[] = [[0, 0], [0.001, 0], [0.002, 0], [0.002, 0.000054], [0.0021, 0.001], [0.0022, 0.002]];
    const cues = new Map<number, PathCue>([[3, { side: 'left', purpose: 'take the flyover' }]]);
    const texts = buildManeuversFromPath(path, cues).map((i) => i.text);
    expect(texts).toEqual(['Turn left', 'Keep left to take the flyover', 'Arrive at destination']);
  });
});

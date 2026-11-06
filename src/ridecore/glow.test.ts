import { describe, expect, it } from 'vitest';
import { GLOW_MAX_START_M, GLOW_MIN_START_M, turnGlow } from './glow';

const kmh = (speed: number) => speed / 3.6;

describe('the edge glow for turns', () => {
  it('lights the side the turn goes to', () => {
    expect(turnGlow('left', 50, null)?.side).toBe('left');
    expect(turnGlow('sharp-left', 50, null)?.side).toBe('left');
    expect(turnGlow('slight-right', 50, null)?.side).toBe('right');
    // Left-hand traffic: a U-turn goes round to the right.
    expect(turnGlow('uturn', 50, null)?.side).toBe('right');
    expect(turnGlow('arrive', 50, null)).toMatchObject({ side: 'both', arrive: true });
  });

  it('stays dark going straight on, or with no turn known', () => {
    expect(turnGlow('straight', 20, null)).toBeNull();
    expect(turnGlow(null, 20, null)).toBeNull();
    expect(turnGlow('left', null, null)).toBeNull();
    expect(turnGlow('left', Number.NaN, null)).toBeNull();
  });

  it('starts earlier the faster the ride', () => {
    expect(turnGlow('left', GLOW_MIN_START_M + 10, kmh(10))).toBeNull();
    expect(turnGlow('left', 300, kmh(100))).not.toBeNull();
    expect(turnGlow('left', GLOW_MAX_START_M + 10, kmh(200))).toBeNull();
  });

  it('grows as the turn comes, and pulses at it', () => {
    const far = turnGlow('left', 140, null)!;
    const near = turnGlow('left', 60, null)!;
    const at = turnGlow('left', 0, null)!;
    expect(far.strength).toBeLessThan(near.strength);
    expect(near.strength).toBeLessThan(at.strength);
    expect(at.strength).toBe(1);
    expect(near.urgent).toBe(false);
    expect(turnGlow('left', 30, null)!.urgent).toBe(true);
    // Fast, "now" comes sooner: three seconds out.
    expect(turnGlow('left', 70, kmh(90))!.urgent).toBe(true);
  });

  it('glows softer for a slight turn', () => {
    expect(turnGlow('slight-left', 0, null)!.strength).toBeLessThan(turnGlow('left', 0, null)!.strength);
  });
});

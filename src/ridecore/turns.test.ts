import { describe, expect, it } from 'vitest';
import { upcomingTurns } from './turns';

const route = [
  { text: 'Head north', distanceMeters: 0, maneuver: 'depart' },
  { text: 'Turn left', distanceMeters: 400, maneuver: 'turn-left' },
  { text: 'Turn right', distanceMeters: 1200, maneuver: 'turn-right' },
  { text: 'Arrive at destination', distanceMeters: 300, maneuver: 'arrive' },
];

describe('upcomingTurns', () => {
  it('counts each later turn on from the next one', () => {
    const turns = upcomingTurns(route, route[1], 150);
    expect(turns.map((turn) => [turn.instruction.text, turn.distanceMeters])).toEqual([
      ['Turn left', 150],
      ['Turn right', 1350],
      ['Arrive at destination', 1650],
    ]);
  });

  it('stops at the limit', () => {
    expect(upcomingTurns(route, route[0], 0, 2)).toHaveLength(2);
  });

  it('still shows the next turn when it is not on the route given', () => {
    const elsewhere = { text: 'Keep right', distanceMeters: 90 };
    expect(upcomingTurns(route, elsewhere, 60)).toEqual([{ instruction: elsewhere, distanceMeters: 60 }]);
  });

  it('is empty with nothing ahead', () => {
    expect(upcomingTurns(route, undefined, 100)).toEqual([]);
    expect(upcomingTurns(route, route[1], undefined)).toEqual([]);
  });
});

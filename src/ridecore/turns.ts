import type { RouteSignal, TurnInstruction } from './engine';

export interface UpcomingTurn {
  instruction: TurnInstruction;
  /** From the rider to the turn, along the route. */
  distanceMeters: number;
  /** A traffic signal at the turn's junction. */
  signal?: boolean;
}

/**
 * A signal this close to a turn is at its junction: a wide junction's signal can stand
 * 40 m before the turn. TrailCompass's banner uses the same span (turn-instructions.ts).
 */
const SIGNAL_AT_TURN_M = 50;

/**
 * The turns still ahead, each with how far off it is: the next one at the distance
 * navigation counts down to it, each later one that plus the road leading up to it
 * (an instruction's distance is the travel before it, turn-instructions.ts). With the
 * route's signals, a turn with one at its junction is marked; never the arrival.
 */
export function upcomingTurns(
  instructions: TurnInstruction[],
  next: TurnInstruction | undefined,
  toNextMeters: number | undefined,
  limit = 60,
  signals: RouteSignal[] = [],
): UpcomingTurn[] {
  if (!next || toNextMeters == null) return [];
  const start = instructions.indexOf(next);
  // Not on the route being followed (a reroute landing): the next turn is still known.
  if (start < 0) return [{ instruction: next, distanceMeters: toNextMeters }];
  // Where each turn is along the route, measured as the signals are.
  let along = 0;
  for (let i = 0; i < start; i++) along += instructions[i]!.distanceMeters;
  const turns: UpcomingTurn[] = [];
  let distance = toNextMeters;
  for (let i = start; i < instructions.length && turns.length < limit; i++) {
    const instruction = instructions[i]!;
    along += instruction.distanceMeters;
    if (i > start) distance += instruction.distanceMeters;
    const signal = instruction.maneuver !== 'arrive' && signals.some((s) => Math.abs(s.alongMeters - along) <= SIGNAL_AT_TURN_M);
    turns.push({ instruction, distanceMeters: distance, ...(signal ? { signal } : {}) });
  }
  return turns;
}

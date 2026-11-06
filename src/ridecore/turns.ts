import type { TurnInstruction } from './engine';

export interface UpcomingTurn {
  instruction: TurnInstruction;
  /** From the rider to the turn, along the route. */
  distanceMeters: number;
}

/**
 * The turns still ahead, each with how far off it is: the next one at the distance
 * navigation counts down to it, each later one that plus the road leading up to it
 * (an instruction's distance is the travel before it, turn-instructions.ts).
 */
export function upcomingTurns(
  instructions: TurnInstruction[],
  next: TurnInstruction | undefined,
  toNextMeters: number | undefined,
  limit = 60,
): UpcomingTurn[] {
  if (!next || toNextMeters == null) return [];
  const start = instructions.indexOf(next);
  // Not on the route being followed (a reroute landing): the next turn is still known.
  if (start < 0) return [{ instruction: next, distanceMeters: toNextMeters }];
  const turns: UpcomingTurn[] = [];
  let distance = toNextMeters;
  for (let i = start; i < instructions.length && turns.length < limit; i++) {
    if (i > start) distance += instructions[i]!.distanceMeters;
    turns.push({ instruction: instructions[i]!, distanceMeters: distance });
  }
  return turns;
}

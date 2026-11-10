import type {
  Coordinate,
  InstructionStructure,
  TurnInstruction,
} from './routing-adapter';
import {
  bearingDegrees,
  haversineMeters,
  turnAngleDegrees,
} from './geo';

const MIN_SEGMENT_M = 12;
const TURN_THRESHOLD_DEG = 35;

/**
 * A choice the road network knows about that the path's angles don't show,
 * such as the shallow fork where a flyover leaves the road below it.
 */
export interface PathCue {
  /** Which way to bear, or null when the branches can't be told apart by side. */
  side: 'left' | 'right' | null;
  /** What the choice is for, to follow "Keep left to …": "take the flyover". */
  purpose: string;
  /** Carried onto the instruction, for the banner's sign. */
  structure?: InstructionStructure;
}

function maneuverFromAngle(angle: number): { text: string; maneuver: string } {
  if (Math.abs(angle) < TURN_THRESHOLD_DEG) {
    return { text: 'Continue straight', maneuver: 'straight' };
  }
  if (angle > 120) return { text: 'Make a sharp right', maneuver: 'sharp right' };
  if (angle < -120) return { text: 'Make a sharp left', maneuver: 'sharp left' };
  if (angle > 0) return { text: 'Turn right', maneuver: 'right' };
  return { text: 'Turn left', maneuver: 'left' };
}

/**
 * "Turn left to stay below the flyover" when the path turns there anyway,
 * else "Keep right to take the flyover", or "Take the flyover" with no side.
 */
function maneuverFromCue(
  cue: PathCue,
  angle: number,
): { text: string; maneuver: string } {
  if (Math.abs(angle) >= TURN_THRESHOLD_DEG) {
    const turn = maneuverFromAngle(angle);
    return { text: `${turn.text} to ${cue.purpose}`, maneuver: turn.maneuver };
  }
  if (cue.side) {
    return {
      text: `Keep ${cue.side} to ${cue.purpose}`,
      maneuver: `slight ${cue.side}`,
    };
  }
  return {
    text: cue.purpose.charAt(0).toUpperCase() + cue.purpose.slice(1),
    maneuver: 'continue',
  };
}

/**
 * Derive turn-by-turn instructions from a snapped path polyline. `cues`
 * (by path index) add maneuvers the angles miss; one is never dropped for
 * being close to the last turn.
 */
export function buildManeuversFromPath(
  path: Coordinate[],
  cues?: ReadonlyMap<number, PathCue>,
): TurnInstruction[] {
  if (path.length < 2) {
    return [{ text: 'Arrive at destination', distanceMeters: 0, maneuver: 'arrive' }];
  }

  const instructions: TurnInstruction[] = [];
  let segmentStart = 0;
  let lastBearing = bearingDegrees(path[0]!, path[1]!);
  const distanceSinceLast = (end: number) => {
    let meters = 0;
    for (let j = segmentStart + 1; j <= end; j++) {
      meters += haversineMeters(path[j - 1]!, path[j]!);
    }
    return meters;
  };

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1]!;
    const cur = path[i]!;
    const next = path[i + 1]!;
    const cue = cues?.get(i);
    if (!cue && haversineMeters(prev, cur) < 2) continue;

    const outgoing = bearingDegrees(cur, next);
    const angle = turnAngleDegrees(lastBearing, outgoing);

    if (cue) {
      instructions.push({
        ...maneuverFromCue(cue, angle),
        distanceMeters: distanceSinceLast(i),
        ...(cue.structure ? { structure: cue.structure } : {}),
      });
      segmentStart = i;
    } else if (Math.abs(angle) >= TURN_THRESHOLD_DEG) {
      const distanceMeters = distanceSinceLast(i);
      if (distanceMeters >= MIN_SEGMENT_M || instructions.length === 0) {
        const { text, maneuver } = maneuverFromAngle(angle);
        instructions.push({ text, distanceMeters, maneuver });
        segmentStart = i;
      }
    }
    lastBearing = outgoing;
  }

  const finalDistance = distanceSinceLast(path.length - 1);
  instructions.push({
    text: 'Arrive at destination',
    distanceMeters: Math.max(finalDistance, 1),
    maneuver: 'arrive',
  });

  if (instructions.length === 1 && path.length >= 2) {
    return [
      {
        text: 'Head toward destination',
        distanceMeters: finalDistance,
        maneuver: 'depart',
      },
      instructions[0]!,
    ];
  }

  // Label the first leg as depart when it was a continue/turn placeholder.
  if (instructions[0] && instructions[0].maneuver !== 'arrive') {
    instructions[0] = {
      ...instructions[0],
      text:
        instructions[0].maneuver === 'straight'
          ? 'Head toward destination'
          : instructions[0].text,
      maneuver: 'depart',
    };
  }

  return instructions;
}

import type {
  Coordinate,
  InstructionStructure,
  RouteStructure,
} from './routing-adapter';
import type { RoadStructure } from './road-attributes';
import type { PathCue } from './maneuver-builder';
import {
  bearingDegrees,
  pointAlongPolylineMeters,
  polylineLengthMeters,
  projectOntoPolyline,
  turnAngleDegrees,
} from './geo';

/**
 * Bridges and tunnels in turn-by-turn guidance. A flyover leaves the road
 * below it at a shallow angle, so the turn-angle maneuvers never mention
 * it, and on the map the two lines lie almost on top of each other. At each
 * such fork this says which one the route takes: up onto the flyover, or
 * along the road beside and under it (and the same for underpasses, and for
 * ramps off a flyover).
 */

/** How far down each branch of a fork to look for a bridge or tunnel. */
export const STRUCTURE_LOOKAHEAD_M = 300;
/** A branch's direction is measured to this far past the fork. */
const BEARING_SAMPLE_M = 40;
/** Branches further apart than this go somewhere else: a turn, not a flyover fork. */
const MAX_FORK_SPREAD_DEG = 50;
/** Closer than this is straight on; no side to tell. */
const MIN_SIDE_DEG = 0.5;
/** A bridge this close to the other road runs beside it: a flyover over it, not a bridge elsewhere. */
const SIDE_BY_SIDE_M = 80;
/** Unnamed stretches shorter than this get no label on the map. */
const MIN_LABELLED_M = 100;

/** One road segment of a branch (a graph edge, as far as guidance cares). */
export interface BranchStep {
  structure: RoadStructure | null;
  structureName: string | null;
  /** From where the previous step ended. */
  geometry: Coordinate[];
}

export interface ForkCue extends PathCue {
  /** Which way, for the banner's sign; its `term` also labels the stretch on the map. */
  structure: InstructionStructure;
  /**
   * The step of the route's own branch that the cue is about (where the
   * flyover it takes starts; -1 for the one it is already on), if unnamed.
   */
  labelStep?: number;
}

interface Branch {
  path: Coordinate[];
  bearing: number;
  /** Index of the first step on a bridge or in a tunnel, or -1. */
  first: number;
  steps: BranchStep[];
}

/**
 * The cue for a fork, or null when the branches don't differ in a way the
 * rider could get wrong. `chosen` is the route's way on and `others` the
 * other ways out, each as far as STRUCTURE_LOOKAHEAD_M; `arrivingOn` is
 * the step the route reaches the fork by.
 */
export function forkCue(
  arrivingOn: BranchStep,
  chosen: BranchStep[],
  others: BranchStep[][],
): ForkCue | null {
  const route = describe(chosen);
  if (!route) return null;
  const level = arrivingOn.structure;

  let nearest: { branch: Branch; spread: number } | null = null;
  let rightOfOne = false;
  let leftOfOne = false;
  for (const steps of others) {
    const other = describe(steps);
    if (!other || !differs(level, route, other)) continue;
    // Positive: the route bears right of this branch.
    const spread = turnAngleDegrees(other.bearing, route.bearing);
    if (Math.abs(spread) > MAX_FORK_SPREAD_DEG) continue;
    if (spread > MIN_SIDE_DEG) rightOfOne = true;
    if (spread < -MIN_SIDE_DEG) leftOfOne = true;
    if (!nearest || Math.abs(spread) < Math.abs(nearest.spread)) {
      nearest = { branch: other, spread };
    }
  }
  if (!nearest) return null;
  // Between two branches that both differ: "keep left" would mislead.
  const side = rightOfOne && !leftOfOne ? 'right' : leftOfOne && !rightOfOne ? 'left' : null;
  const other = nearest.branch;

  if (level) {
    // Already up on a flyover (or in a tunnel): a ramp off it, or on along it.
    const name = arrivingOn.structureName;
    const term = level === 'bridge' ? 'flyover' : 'tunnel';
    const ref = name ?? `the ${term}`;
    const staying = stays(level, route);
    const purpose = staying
      ? `${level === 'bridge' ? 'stay on' : 'stay in'} ${ref}`
      : `exit ${ref}`;
    return {
      side,
      purpose,
      structure: { kind: level, action: staying ? 'stay' : 'exit', term },
      ...(name ? {} : { labelStep: -1 }),
    };
  }

  if (route.first >= 0) {
    const beside = sideBySide(route, other.path);
    const step = route.steps[route.first]!;
    const kind = step.structure!;
    const term = termFor(kind, beside);
    return {
      side,
      purpose: `take ${step.structureName ?? `the ${term}`}`,
      structure: { kind, action: 'take', term },
      ...(step.structureName ? {} : { labelStep: route.first }),
    };
  }
  const step = other.steps[other.first]!;
  const kind = step.structure!;
  const beside = sideBySide(other, route.path);
  const term = termFor(kind, beside);
  const ref = step.structureName ?? `the ${term}`;
  const below = kind === 'bridge' && beside;
  return {
    side,
    purpose: below ? `stay below ${ref}` : `avoid ${ref}`,
    structure: { kind, action: below ? 'below' : 'avoid', term },
  };
}

/**
 * The route's bridges and tunnels, from its steps in order. `terms` gives
 * the word a cue used for the stretch holding that step, so the map labels
 * it the way the banner and voice called it.
 */
export function routeStructures(
  steps: BranchStep[],
  terms: ReadonlyMap<number, string> = new Map(),
): RouteStructure[] {
  const out: RouteStructure[] = [];
  let i = 0;
  while (i < steps.length) {
    const kind = steps[i]!.structure;
    if (!kind) {
      i++;
      continue;
    }
    const coordinates: Coordinate[] = [steps[i]!.geometry[0]!];
    let name: string | null = null;
    let term: string | undefined;
    while (i < steps.length && steps[i]!.structure === kind) {
      const step = steps[i]!;
      coordinates.push(...step.geometry.slice(1));
      name ??= step.structureName;
      term ??= terms.get(i);
      i++;
    }
    const label =
      name ??
      (term
        ? capitalize(term)
        : polylineLengthMeters(coordinates) >= MIN_LABELLED_M
          ? kind === 'bridge'
            ? 'Bridge'
            : 'Tunnel'
          : undefined);
    if (coordinates.length >= 2) {
      out.push({ kind, ...(label ? { label } : {}), coordinates });
    }
  }
  return out;
}

function describe(steps: BranchStep[]): Branch | null {
  const path = joinSteps(steps);
  if (path.length < 2) return null;
  const length = polylineLengthMeters(path);
  if (length <= 0) return null;
  const ahead = pointAlongPolylineMeters(path, Math.min(BEARING_SAMPLE_M, length));
  if (!ahead) return null;
  return {
    path,
    bearing: bearingDegrees(path[0]!, ahead.coordinate),
    first: steps.findIndex((s) => s.structure != null),
    steps,
  };
}

/** Whether a rider could take the wrong one of these two. */
function differs(level: RoadStructure | null, route: Branch, other: Branch): boolean {
  if (level) return stays(level, route) !== stays(level, other);
  return firstKind(route) !== firstKind(other);
}

function firstKind(branch: Branch): RoadStructure | null {
  return branch.first >= 0 ? branch.steps[branch.first]!.structure : null;
}

/** Every step on `level`: on along the flyover, not down a ramp. */
function stays(level: RoadStructure, branch: Branch): boolean {
  return branch.steps.every((s) => s.structure === level);
}

/**
 * Whether the bridge or tunnel on `structured` still runs close to `road`
 * at its furthest point within the lookahead: it goes over or under that
 * road (a flyover, an underpass) rather than heading off across a river.
 */
function sideBySide(structured: Branch, road: Coordinate[]): boolean {
  let walked = 0;
  let furthest: Coordinate | null = null;
  for (const step of structured.steps) {
    if (walked >= STRUCTURE_LOOKAHEAD_M) break;
    const length = polylineLengthMeters(step.geometry);
    if (step.structure) {
      furthest =
        pointAlongPolylineMeters(step.geometry, STRUCTURE_LOOKAHEAD_M - walked)?.coordinate ??
        furthest;
    }
    walked += length;
  }
  if (!furthest) return false;
  const gap = projectOntoPolyline(furthest, road)?.distanceToRouteMeters;
  return gap != null && gap < SIDE_BY_SIDE_M;
}

function termFor(structure: RoadStructure, beside: boolean): string {
  if (structure === 'bridge') return beside ? 'flyover' : 'bridge';
  return beside ? 'underpass' : 'tunnel';
}

function joinSteps(steps: BranchStep[]): Coordinate[] {
  const path: Coordinate[] = [];
  for (const step of steps) {
    path.push(...(path.length === 0 ? step.geometry : step.geometry.slice(1)));
  }
  return path;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

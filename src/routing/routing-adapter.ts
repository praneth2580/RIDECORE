import type { RoutingProfileId } from './routing-profiles';

export type Coordinate = [longitude: number, latitude: number];

/**
 * What a maneuver does about a bridge or tunnel just ahead, for the
 * banner's sign. From the ground: `take` it (up onto the flyover, into the
 * underpass), go `below` the flyover, or `avoid` it. Already on or in one:
 * `stay` on it or `exit` it.
 */
export interface InstructionStructure {
  kind: 'bridge' | 'tunnel';
  action: 'take' | 'below' | 'avoid' | 'stay' | 'exit';
  /** The word used for it: "flyover", "bridge", "underpass" or "tunnel". */
  term: string;
}

export interface TurnInstruction {
  text: string;
  distanceMeters: number;
  maneuver?: string;
  /** Set when the maneuver is about a bridge or tunnel (the flyover forks). */
  structure?: InstructionStructure;
}

/** A stretch of a route on a bridge or flyover, or in a tunnel or underpass. */
export interface RouteStructure {
  kind: 'bridge' | 'tunnel';
  /** What the map calls it: its name, or "Flyover", "Bridge"…; none when short and unnamed. */
  label?: string;
  coordinates: Coordinate[];
}

/** A traffic signal the route stops at: one per junction, however many poles it has. */
export interface RouteSignal {
  coordinate: Coordinate;
  /** Where along the route, measured like instruction distances. */
  alongMeters: number;
}

export interface CalculatedRoute {
  coordinates: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
  instructions: TurnInstruction[];
  /** Bridges and tunnels along it, in order. Absent when the engine doesn't know. */
  structures?: RouteStructure[];
  /** Traffic signals along it, in order. Absent when the engine doesn't know. */
  signals?: RouteSignal[];
  id?: string;
  profile?: RoutingProfileId;
  label?: string;
  meta?: { edgeCount?: number };
}

export interface RouteRequestOptions {
  waypoints?: Coordinate[];
  profile?: RoutingProfileId;
  /** How many distinct corridor alternatives to return (including best). */
  alternatives?: number;
  /** Ride motorways / expressways not tagged for motorcycles. Default false. */
  allowExpressways?: boolean;
  /** Cancels an in-flight road download when the rider changes the trip. */
  signal?: AbortSignal;
}

export interface RoutingAdapter {
  calculateRoute(
    start: Coordinate,
    end: Coordinate,
    waypointsOrOptions?: Coordinate[] | RouteRequestOptions,
  ): Promise<CalculatedRoute>;

  calculateRoutes?(
    start: Coordinate,
    end: Coordinate,
    options?: RouteRequestOptions,
  ): Promise<CalculatedRoute[]>;
}

export { offlineRoutingAdapter as defaultRoutingAdapter } from './offline-adapter';

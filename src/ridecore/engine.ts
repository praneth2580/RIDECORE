/**
 * RIDECORE's one door into TrailCompass, its engine: routing, turn-by-turn,
 * offline maps, GPS, ride recording and storage.
 *
 * RIDECORE's screens import TrailCompass only through this file. When a merge
 * changes one of TrailCompass's APIs, this is where RIDECORE adapts.
 */
import { compassService } from '../services/compass.service';
import { locationService } from '../services/location.service';
import { mapService } from '../services/map.service';
import { navigationService } from '../services/navigation.service';
import { tripPlanner } from '../services/trip-planner.service';
import { ROUTING_PROFILES, type RoutingProfileId } from '../routing/routing-profiles';
import type { Coordinate } from '../routing/routing-adapter';
import type { SavedRoute } from '../types/route';
import type { TripStop } from '../types/trip-stop';
import { getZoomMultiplier, setZoomMultiplier } from './overrides/services/nav-display';

export { MapView } from '../components/MapView';
export { useKeepAwake } from '../hooks/useKeepAwake';
export { offlineRoutingAdapter, type OfflineEngineStatus } from '../routing/offline-adapter';
export {
  maneuverKind,
  formatManeuverDistance,
  signalWarningLabel,
  structureSign,
  type ManeuverKind,
  type SignalAhead,
  type StructureSign,
} from '../routing/turn-instructions';
export { formatArrivalTime, formatSavedAt } from '../routing/route-naming';
export { backgroundPlanning } from '../services/background-planning.service';
export { checkForPoiUpdate } from '../services/poi-data.service';
export { downloadPolicy } from '../services/download-policy.service';
export { formatAccuracy, gpsWarning, isFixStale } from '../services/location.service';
export { mapPackService, type MapPackMeta } from '../services/map-pack.service';
export { searchPlaces } from '../services/place-search.service';
export { formatDuration, formatKm } from '../services/ride-format';
export { rideLogService, type LiveRide } from '../services/ride-log.service';
export { routeLibrary } from '../services/route-library.service';
export { voiceGuidance } from '../services/voice-guidance.service';
export { createTripStop } from '../types/trip-stop';
export { mapTheme } from '../theme/map-theme';
export type { RideRecord } from '../database/ride-repository';
export type { TripPlannerState } from '../services/trip-planner.service';
export type { Coordinate, RouteSignal, TurnInstruction } from '../routing/routing-adapter';
export { ROUTING_PROFILES, type RoutingProfileId };
export type { CompassReading, GpsFix, NavigationState } from '../types/navigation';
export type { PlaceHit, TripStop } from '../types/trip-stop';
export type { SavedRoute } from '../types/route';
export { compassService, locationService, mapService, navigationService, tripPlanner };

/** Bumped by every plan and every end, so a slow plan can't land after either. */
let planToken = 0;

const PROFILE_KEY = 'ridecore.routeProfile';

/** How routes are planned: the rider picks these while choosing a route. */
export interface RouteOptions {
  profile: RoutingProfileId;
  /** Most expressways in India ban two-wheelers, so they're left out unless allowed. */
  expressways: boolean;
}

/**
 * The rider's route options, kept between trips. TrailCompass keeps the expressways
 * choice itself; its route type lasts only as long as the app, so RIDECORE keeps that one.
 */
export function getRouteOptions(): RouteOptions {
  const saved = localStorage.getItem(PROFILE_KEY);
  return {
    profile: ROUTING_PROFILES.find((profile) => profile.id === saved)?.id ?? 'fastest',
    expressways: navigationService.getAllowExpressways(),
  };
}

/** Keeps the options for the next plan. Re-planning the trip on offer is the caller's call. */
export function setRouteOptions(options: RouteOptions): void {
  localStorage.setItem(PROFILE_KEY, options.profile);
  navigationService.setProfile(options.profile);
  navigationService.setAllowExpressways(options.expressways);
}

const ZOOM_KEY = 'ridecore.zoomMultiplier';

/**
 * How strongly the map zooms out with speed, picked in Settings: ×1 is TrailCompass's
 * own curve. The map zooms by speed on the dash and while navigating.
 */
export const SPEED_ZOOM_MULTIPLIERS = [0.5, 1, 1.5] as const;
export type SpeedZoom = (typeof SPEED_ZOOM_MULTIPLIERS)[number];

export function getSpeedZoom(): SpeedZoom {
  return SPEED_ZOOM_MULTIPLIERS.find((m) => m === getZoomMultiplier()) ?? 1;
}

export function setSpeedZoom(multiplier: SpeedZoom): void {
  localStorage.setItem(ZOOM_KEY, String(multiplier));
  setZoomMultiplier(multiplier);
}

/** The saved multiplier, before the map first zooms. */
function restoreSpeedZoom(): void {
  try {
    const saved = Number(localStorage.getItem(ZOOM_KEY));
    const multiplier = SPEED_ZOOM_MULTIPLIERS.find((m) => m === saved);
    if (multiplier) setZoomMultiplier(multiplier);
  } catch {
    // No storage (tests): TrailCompass's curve.
  }
}
restoreSpeedZoom();

/** Where the route starts: a fresh GPS fix, else the last one, else the map's centre. */
async function startPoint(): Promise<Coordinate> {
  try {
    const fix = await locationService.ensureFix(8_000);
    return [fix.longitude, fix.latitude];
  } catch (e) {
    const last = locationService.getLastFix();
    if (last) return [last.longitude, last.latitude];
    const center = mapService.getCenter();
    if (center) return center;
    throw e instanceof Error ? e : new Error('Need GPS to plan a route');
  }
}

/**
 * Plans a route from here to a place. Resolves to an error message, or null when
 * the routes are on offer (navigation state "choosing") or the plan was superseded.
 */
export async function planTo(stop: TripStop): Promise<string | null> {
  const token = ++planToken;
  // A saved trip, once offered, leaves its own route type behind in the engine.
  navigationService.setProfile(getRouteOptions().profile);
  tripPlanner.setDestination(stop);
  mapService.setDestination(stop.coordinate);
  mapService.clearItineraryStops();
  navigationService.setDestination(stop.coordinate);
  navigationService.setWaypoints([]);
  navigationService.cancelPlanning();
  navigationService.showPlanning('Getting GPS…');
  try {
    const start = await startPoint();
    if (token !== planToken) return null;
    mapService.centerOn(start);
    const result = await navigationService.planRoute(start, stop.coordinate, []);
    if (token !== planToken || result !== 'error') return null;
    return navigationService.getState().message ?? 'Could not plan the route';
  } catch (e) {
    if (token !== planToken) return null;
    navigationService.cancelPlanning();
    return e instanceof Error ? e.message : 'Could not plan the route';
  }
}

/** Ends the trip, planned or under way: route, destination and stops all go. */
export function endTrip(): void {
  planToken += 1;
  tripPlanner.clear();
  navigationService.clearItinerary();
}

/** Puts a saved trip on offer, ready to start without planning. */
export function offerSavedRoute(route: SavedRoute): void {
  planToken += 1;
  tripPlanner.loadFromSaved(route.end, route.waypoints ?? [], route.places);
  navigationService.loadSavedRoute(route);
}

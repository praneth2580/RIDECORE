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
import type { Coordinate } from '../routing/routing-adapter';
import type { SavedRoute } from '../types/route';
import type { TripStop } from '../types/trip-stop';

export { MapView } from '../components/MapView';
export { useKeepAwake } from '../hooks/useKeepAwake';
export { offlineRoutingAdapter, type OfflineEngineStatus } from '../routing/offline-adapter';
export { maneuverKind, formatManeuverDistance, type ManeuverKind } from '../routing/turn-instructions';
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
export type { Coordinate } from '../routing/routing-adapter';
export type { CompassReading, GpsFix, NavigationState } from '../types/navigation';
export type { PlaceHit, TripStop } from '../types/trip-stop';
export type { SavedRoute } from '../types/route';
export { compassService, locationService, mapService, navigationService, tripPlanner };

/** Bumped by every plan and every end, so a slow plan can't land after either. */
let planToken = 0;

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

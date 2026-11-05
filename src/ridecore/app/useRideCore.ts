import { useEffect, useRef, useState } from 'react';
import {
  backgroundPlanning,
  checkForPoiUpdate,
  compassService,
  downloadPolicy,
  formatKm,
  locationService,
  mapPackService,
  mapService,
  navigationService,
  offlineRoutingAdapter,
  rideLogService,
  routeLibrary,
  tripPlanner,
  voiceGuidance,
  type CompassReading,
  type GpsFix,
  type LiveRide,
  type NavigationState,
  type OfflineEngineStatus,
  type TripPlannerState,
} from '../engine';

export interface Toast {
  message: string;
  tone: 'info' | 'success' | 'error';
}

/** What the engine is doing, as React state. */
export interface RideCoreState {
  fix: GpsFix | null;
  locationError?: string;
  compass: CompassReading | null;
  nav: NavigationState;
  engine: OfflineEngineStatus;
  trip: TripPlannerState;
  ride: LiveRide | null;
  /** Ticks every second: the clock, the ride timer, GPS going stale. */
  now: number;
}

/** The fuel and food data check waits until the app has settled. */
const POI_UPDATE_DELAY_MS = 20_000;

/**
 * Starts TrailCompass's engine and follows it. Mount once, at the app's root.
 * TrailCompass's own app check for updates is left out: it offers TrailCompass's
 * releases, not RIDECORE's.
 */
export function useRideCore(toast: (toast: Toast) => void): RideCoreState {
  const [fix, setFix] = useState<GpsFix | null>(() => locationService.getLastFix());
  const [locationError, setLocationError] = useState<string>();
  const [compass, setCompass] = useState<CompassReading | null>(null);
  const [nav, setNav] = useState(() => navigationService.getState());
  const [engine, setEngine] = useState(() => offlineRoutingAdapter.getStatus());
  const [trip, setTrip] = useState(() => tripPlanner.getState());
  const [ride, setRide] = useState(() => rideLogService.getLive());
  const [now, setNow] = useState(() => Date.now());
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  });

  useEffect(() => {
    let fedFix: GpsFix | null = null;
    const offLocation = locationService.subscribe((next, error) => {
      // Before setFix, so each fix renders with its own spot on the route.
      if (next && next !== fedFix) {
        fedFix = next;
        navigationService.updatePosition([next.longitude, next.latitude], next.accuracyMeters);
      }
      setFix(next);
      setLocationError(error);
    });
    const offCompass = compassService.subscribe(setCompass);
    const offNav = navigationService.subscribe(setNav);
    const offVoice = navigationService.subscribe((state) =>
      voiceGuidance.update(state, locationService.getLastFix()?.speedMps ?? null),
    );
    const offEngine = offlineRoutingAdapter.subscribe(setEngine);
    const offTrip = tripPlanner.subscribe(setTrip);
    // A new map style drops what was drawn on it: put the trip back.
    const offMap = mapService.subscribeStatus((status) => {
      if (!status.ok) return;
      mapService.setDestination(tripPlanner.getDestinationCoordinate());
      navigationService.redrawMap();
    });
    const offRide = rideLogService.subscribe(() => setRide(rideLogService.getLive()));
    const offRideSaved = rideLogService.subscribeSaved((saved, reason) =>
      toastRef.current(
        saved
          ? { message: `Saved “${saved.name}” · ${formatKm(saved.distanceMeters)}`, tone: 'success' }
          : { message: reason ?? 'Ride not saved', tone: 'error' },
      ),
    );
    // Planning a route gets its own notification, with Pause and Stop.
    const offBackgroundPlanning = backgroundPlanning.watch();

    void locationService.startWatching();
    void compassService.start();
    void navigationService.ensureEngine();
    void downloadPolicy.start();
    // A ride under way carries on (Android records with the app closed too).
    void rideLogService.init();
    // Maps of deleted trips go at start-up.
    void routeLibrary
      .list()
      .then((routes) => mapPackService.pruneOrphans(routes.map((route) => route.id)))
      .catch(() => undefined);

    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poiUpdate = window.setTimeout(() => void checkForPoiUpdate(), POI_UPDATE_DELAY_MS);

    return () => {
      offLocation();
      offCompass();
      offNav();
      offVoice();
      offEngine();
      offTrip();
      offMap();
      offRide();
      offRideSaved();
      offBackgroundPlanning();
      window.clearInterval(tick);
      window.clearTimeout(poiUpdate);
      void locationService.stopWatching();
      compassService.stop();
    };
  }, []);

  return { fix, locationError, compass, nav, engine, trip, ride, now };
}

import { useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  endTrip,
  mapService,
  navigationService,
  offerSavedRoute,
  planTo,
  rideLogService,
  useKeepAwake,
  voiceGuidance,
  type RideRecord,
  type SavedRoute,
  type TripStop,
} from '../engine';
import { device, loadKeepScreenOn, saveKeepScreenOn, type Layout } from '../device';
import { Controls } from '../components/Controls';
import { MapZone } from '../components/MapZone';
import { SpeedDial } from '../components/SpeedDial';
import { StatusLine } from '../components/StatusLine';
import { TripReadout } from '../components/TripReadout';
import { speedKmh } from '../format';
import { ChooseLayout } from '../screens/ChooseLayout';
import { MenuSheet } from '../screens/MenuSheet';
import { EndSheet, RideSheet } from '../screens/QuickSheets';
import { WhereToSheet } from '../screens/WhereToSheet';
import { useBattery } from './useBattery';
import { useRideCore, type Toast } from './useRideCore';

type Overlay = 'whereto' | 'menu' | 'ride' | 'end' | null;

/** Set once RIDECORE has switched TrailCompass's fuel and food pins off for its first start. */
const PINS_DEFAULT_KEY = 'ridecore.pinsDefault';

/**
 * RIDECORE is a navigation device, not an app with pages: one screen with speed, the road
 * ahead and the trip, a few buttons for what the moment needs, and sheets over it for the rest.
 */
export function App() {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [followGps, setFollowGps] = useState(true);
  const [viewedRide, setViewedRide] = useState<RideRecord | null>(null);
  const [voiceOn, setVoiceOn] = useState(() => voiceGuidance.isEnabled());
  /** Undefined while reading it; null until the rider has picked one. */
  const [layout, setLayout] = useState<Layout | null>();
  const [keepOn, setKeepOn] = useState(loadKeepScreenOn);
  const core = useRideCore(setToast);
  const battery = useBattery();
  const { nav, ride } = core;
  const navMode = nav.status === 'navigating' || nav.status === 'rerouting';
  // The phone is kept for riding: the screen stays on unless the rider turned that off.
  useKeepAwake(keepOn || navMode);

  // A clean map to start with: fuel and food pins stay off until switched on in Settings.
  useEffect(() => {
    if (localStorage.getItem(PINS_DEFAULT_KEY)) return;
    mapService.setOverlaysShown(false);
    localStorage.setItem(PINS_DEFAULT_KEY, 'off');
  }, []);

  useEffect(() => {
    void device
      .getLayout()
      .then(({ layout: picked }) => setLayout(picked ?? null))
      .catch(() => setLayout(null));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const hideRide = () => {
    rideLogService.hideFromMap();
    setViewedRide(null);
  };

  // Android's back button closes what's open. RIDECORE is the home screen: nothing is behind it.
  const backRef = useRef(() => {});
  useEffect(() => {
    backRef.current = () => {
      if (overlay) setOverlay(null);
      else if (viewedRide) hideRide();
    };
  });
  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', () => backRef.current());
    return () => void listener.then((l) => l.remove());
  }, []);

  const fail = (e: unknown, fallback: string) =>
    setToast({ message: e instanceof Error ? e.message : fallback, tone: 'error' });

  const chooseLayout = (picked: Layout) => {
    void device
      .setLayout({ layout: picked })
      .then(() => setLayout(picked))
      .catch((e: unknown) => fail(e, "Couldn't change the layout"));
  };

  const changeKeepOn = (on: boolean) => {
    saveKeepScreenOn(on);
    setKeepOn(on);
  };

  const toggleVoice = () => {
    voiceGuidance.setEnabled(!voiceOn);
    setVoiceOn(!voiceOn);
  };

  const record = () => {
    if (ride) {
      setOverlay('ride');
      return;
    }
    // A ride that ended under its open sheet (navigation finishing it) leaves the sheet shut.
    setOverlay(null);
    rideLogService
      .start()
      .then(() => setToast({ message: 'Recording the ride', tone: 'success' }))
      .catch((e: unknown) => fail(e, "Couldn't start recording"));
  };

  const runRide = (work: () => Promise<unknown>) => {
    work()
      .then(() => setOverlay(null))
      .catch((e: unknown) => fail(e, 'Something went wrong'));
  };

  const start = () => {
    navigationService.startNavigation(nav.selectedAlternativeIndex);
    setFollowGps(true);
    mapService.resumeNavigationFollow();
  };

  const retry = () => {
    const destination = core.trip.destination;
    if (destination) void planTo(destination).then((error) => error && setToast({ message: error, tone: 'error' }));
  };

  const pickDestination = (stop: TripStop) => {
    setOverlay(null);
    void planTo(stop).then((error) => error && setToast({ message: error, tone: 'error' }));
  };

  const rideTrip = (route: SavedRoute) => {
    setOverlay(null);
    offerSavedRoute(route);
  };

  const showRide = (picked: RideRecord) => {
    setOverlay(null);
    setViewedRide(picked);
    setFollowGps(false);
    // Once the map is showing, so it frames the ride at its real size.
    window.setTimeout(() => void rideLogService.showOnMap(picked), 80);
  };

  // Black for the moment it takes to read the layout, so the chooser never flashes past.
  if (layout === undefined) return <div className="rc-device" />;
  if (layout === null) {
    return (
      <div className="rc-device rc-device-choose">
        <ChooseLayout onChoose={chooseLayout} />
      </div>
    );
  }

  return (
    <div className="rc-device" data-status={nav.status}>
      <StatusLine core={core} battery={battery} />

      <main className="rc-cluster">
        <div className="rc-speed">
          <SpeedDial speed={speedKmh(core.fix, core.now)} />
        </div>
        <MapZone
          core={core}
          followGps={followGps}
          onFollowGps={setFollowGps}
          onWhereTo={() => setOverlay('whereto')}
          viewedRide={viewedRide}
          onHideRide={hideRide}
        />
        <TripReadout core={core} />
      </main>

      <Controls
        core={core}
        voiceOn={voiceOn}
        onToggleVoice={toggleVoice}
        onRecord={record}
        onMenu={() => setOverlay('menu')}
        onStart={start}
        onCancel={endTrip}
        onEnd={() => setOverlay('end')}
        onRetry={retry}
      />

      {overlay === 'whereto' ? (
        <WhereToSheet near={core.fix} onPick={pickDestination} onRideTrip={rideTrip} onClose={() => setOverlay(null)} />
      ) : null}
      {overlay === 'menu' ? (
        <MenuSheet
          layout={layout}
          onLayout={chooseLayout}
          keepOn={keepOn}
          onKeepOn={changeKeepOn}
          onShowRide={showRide}
          onClose={() => setOverlay(null)}
        />
      ) : null}
      {/* Only while there's a ride: it goes when the ride does, however that ends. */}
      {overlay === 'ride' && ride ? <RideSheet ride={ride} onRun={runRide} onClose={() => setOverlay(null)} /> : null}
      {overlay === 'end' ? (
        <EndSheet
          onEnd={() => {
            endTrip();
            setOverlay(null);
          }}
          onClose={() => setOverlay(null)}
        />
      ) : null}

      {toast ? (
        <p className="rc-toast" data-tone={toast.tone} role="status">
          {toast.message}
        </p>
      ) : null}
    </div>
  );
}

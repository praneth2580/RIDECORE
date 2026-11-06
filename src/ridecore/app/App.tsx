import { useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  endTrip,
  getRouteOptions,
  maneuverKind,
  mapService,
  navigationService,
  offerSavedRoute,
  planTo,
  rideLogService,
  setRouteOptions,
  useKeepAwake,
  voiceGuidance,
  type RideRecord,
  type RouteOptions,
  type SavedRoute,
  type TripStop,
} from '../engine';
import { device, loadKeepScreenOn, saveKeepScreenOn, type Layout } from '../device';
import { loadDashShows, saveDashShows, type DashShows } from '../dash';
import { followMedia, togglePlay, useNowPlaying } from '../media';
import { networkMark, useMediaQuery, usePhoneStatus } from '../status';
import { useWeather } from '../weather';
import { MapZone, type ZoneMode } from '../components/MapZone';
import { StatusCorners } from '../components/StatusCorners';
import { TurnGlowEdges } from '../components/TurnGlowEdges';
import { turnGlow } from '../glow';
import { Page } from '../components/Page';
import { Pager, type PagerHandle } from '../components/Pager';
import { RoutePanel } from '../components/RoutePanel';
import { SpeedDial } from '../components/SpeedDial';
import { StatusLine } from '../components/StatusLine';
import { TripReadout } from '../components/TripReadout';
import { gpsState, speedKmh } from '../format';
import { ChooseLayout } from '../screens/ChooseLayout';
import { GoPage, type GoPageHandle } from '../screens/GoPage';
import { MusicPage } from '../screens/MusicPage';
import { AppsPage } from '../screens/AppsPage';
import { RidesPage } from '../screens/RidesPage';
import { SettingsPage } from '../screens/SettingsPage';
import { TripPage } from '../screens/TripPage';
import { useBattery } from './useBattery';
import { useRideCore, type Toast } from './useRideCore';

/**
 * The screens sit round the dash like a plus, each where a rider would reach for it:
 * music to the left; where to (or the trip) to the right, ahead, with rides beyond it;
 * settings pulled down from above, the phone's apps pulled up from below. Everything is
 * a swipe away, rides two. Side by side, swiped left and right:
 */
const MUSIC = 0;
const DASH = 1;
const GO = 2;
const RIDES = 3;
/**
 * The dash's own column, swiped up and down as a phone's home screen is: settings pulled
 * down from above (row 0), the phone's apps swiped up from below.
 */
const DASH_ROW = 1;
const APPS_ROW = 2;

/** Left on another screen this long, the device goes back to the dash, like a watch to its face. */
const RETURN_AFTER_MS = 30_000;
/** A turn this close brings the dash back, whatever page is showing. */
const TURN_NEAR_M = 400;

/** Set once RIDECORE has switched TrailCompass's fuel and food pins off for its first start. */
const PINS_DEFAULT_KEY = 'ridecore.pinsDefault';

/**
 * RIDECORE is the phone's home screen, worked like a watch: screens to swipe through
 * instead of buttons. The dash (speed, the road ahead, the trip) is home. Left of it,
 * music; right of it: where to go (or the trip under way), then rides. Up and down
 * from it: the phone's apps and settings. What's on a screen is what you tap; Home, or
 * leaving it alone, brings the dash back. Choosing a route, or looking around the map,
 * gives the map the whole screen.
 */
export function App() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [page, setPage] = useState(DASH);
  const [row, setRow] = useState(DASH_ROW);
  /** The map taking the screen, to look around or at a ride. */
  const [exploring, setExploring] = useState(false);
  const [followGps, setFollowGps] = useState(true);
  const [viewedRide, setViewedRide] = useState<RideRecord | null>(null);
  const [focusSearch, setFocusSearch] = useState(0);
  /** Searching a place: where-to holds still until the search is closed. */
  const [searching, setSearching] = useState(false);
  const [voiceOn, setVoiceOn] = useState(() => voiceGuidance.isEnabled());
  /** Undefined while reading it; null until the rider has picked one. */
  const [layout, setLayout] = useState<Layout | null>();
  const [keepOn, setKeepOn] = useState(loadKeepScreenOn);
  /** The parts of the dash the rider wants to see. */
  const [shows, setShows] = useState(loadDashShows);
  const [routeOptions, setRouteOptionsState] = useState(getRouteOptions);
  /** The saved trip on offer or under way, if that's where the route came from. */
  const [savedTrip, setSavedTrip] = useState<SavedRoute | null>(null);
  const pagerRef = useRef<PagerHandle>(null);
  const columnRef = useRef<PagerHandle>(null);
  const goRef = useRef<GoPageHandle>(null);
  const core = useRideCore(setToast);
  const battery = useBattery();
  const { nav, fix } = core;
  const media = useNowPlaying();
  const weather = useWeather(fix, shows.weather || shows.topWeather);
  const landscape = useMediaQuery('(orientation: landscape)');
  // Read again now and then while the dash shows, for the signal bars.
  const phoneStatus = usePhoneStatus(page === DASH && row === DASH_ROW);
  const navMode = nav.status === 'navigating' || nav.status === 'rerouting';
  const choosingRoute = nav.status === 'planning' || nav.status === 'choosing' || nav.status === 'error';
  const tripUnderway = navMode || nav.status === 'paused' || nav.status === 'arrived';
  const mode: ZoneMode = choosingRoute ? 'route' : exploring ? 'map' : 'dash';
  // The map with the screen holds the dash; a search holds where-to. Settings and the
  // apps are above and below the dash only: while one is open, sideways goes nowhere,
  // and the way back is the way in.
  const hold = mode !== 'dash' ? DASH : searching ? GO : row !== DASH_ROW ? DASH : null;
  // The phone is kept for riding: the screen stays on unless the rider turned that off.
  useKeepAwake(keepOn || navMode);

  // A clean map to start with: fuel and food pins stay off until switched on in Settings.
  useEffect(() => {
    if (localStorage.getItem(PINS_DEFAULT_KEY)) return;
    mapService.setOverlaysShown(false);
    localStorage.setItem(PINS_DEFAULT_KEY, 'off');
  }, []);

  // The phone's music, followed for as long as RIDECORE runs.
  useEffect(() => followMedia(), []);

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

  /** Back to the dash, from anywhere in either direction. */
  const showDash = () => {
    pagerRef.current?.show(DASH);
    columnRef.current?.show(DASH_ROW);
  };

  // The next turn lights the screen's edge on its side, on whatever screen shows. Not
  // while finding a new route or off it: that turn may not be the one to take.
  const glow =
    shows.turnGlow && nav.status === 'navigating' && !nav.offRoute && nav.currentInstruction
      ? turnGlow(maneuverKind(nav.currentInstruction), nav.distanceToNextManeuverMeters ?? null, fix?.speedMps ?? null)
      : null;

  // A turn coming up, or the end of the trip, brings the dash back.
  const turnNear = navMode && (nav.distanceToNextManeuverMeters ?? Infinity) < TURN_NEAR_M;
  useEffect(() => {
    if (turnNear || nav.status === 'arrived') {
      pagerRef.current?.show(DASH);
      columnRef.current?.show(DASH_ROW);
    }
  }, [turnNear, nav.status]);

  const fail = (e: unknown, fallback: string) =>
    setToast({ message: e instanceof Error ? e.message : fallback, tone: 'error' });

  const closeMap = () => {
    if (viewedRide) rideLogService.hideFromMap();
    setViewedRide(null);
    setExploring(false);
    setFollowGps(true);
    if (navMode) mapService.resumeNavigationFollow();
    else if (fix) mapService.centerOn([fix.longitude, fix.latitude]);
  };

  /** Ends the trip, whether planned, on offer or under way. */
  const finishTrip = () => {
    setSavedTrip(null);
    endTrip();
  };

  // Android's back button closes what's open, then goes back up to the dash.
  // RIDECORE is the home screen: nothing is behind it.
  const backRef = useRef(() => {});
  const homeRef = useRef(() => {});
  useEffect(() => {
    backRef.current = () => {
      if (choosingRoute) finishTrip();
      else if (exploring) closeMap();
      else if (searching) goRef.current?.clear();
      else showDash();
    };
    // Home, as on any home screen, goes back to the first screen: the dash, as it is.
    // A route being chosen stays chosen.
    homeRef.current = () => {
      if (exploring) closeMap();
      goRef.current?.clear();
      showDash();
    };
  });
  useEffect(() => {
    const back = CapacitorApp.addListener('backButton', () => backRef.current());
    const home = device.addListener('home', () => homeRef.current());
    return () => {
      void back.then((l) => l.remove());
      void home.then((l) => l.remove());
    };
  }, []);

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

  const changeShows = (next: DashShows) => {
    saveDashShows(next);
    setShows(next);
  };

  const changeVoice = (on: boolean) => {
    voiceGuidance.setEnabled(on);
    setVoiceOn(on);
  };

  const runRide = (work: () => Promise<unknown>) => {
    work().catch((e: unknown) => fail(e, 'Something went wrong'));
  };

  // Leaving the dash's column sideways closes the apps or settings, as a phone's app
  // drawer closes: coming back finds the dash.
  const changePage = (index: number) => {
    setPage(index);
    if (index !== DASH) columnRef.current?.show(DASH_ROW, false);
  };

  const whereTo = () => {
    columnRef.current?.show(DASH_ROW, false);
    pagerRef.current?.show(GO);
    setFocusSearch((n) => n + 1);
  };

  const openMap = () => {
    setFollowGps(true);
    setExploring(true);
  };

  const start = () => {
    navigationService.startNavigation(nav.selectedAlternativeIndex);
    setFollowGps(true);
    mapService.resumeNavigationFollow();
  };

  const plan = (stop: TripStop) => {
    goRef.current?.clear();
    setSavedTrip(null);
    void planTo(stop).then((error) => error && setToast({ message: error, tone: 'error' }));
  };

  const retry = () => {
    const destination = core.trip.destination;
    if (destination) plan(destination);
  };

  /** New options plan the trip again, unless it's a saved one: that rides as saved. */
  const changeRouteOptions = (next: RouteOptions) => {
    setRouteOptions(next);
    setRouteOptionsState(next);
    if (!savedTrip) retry();
  };

  const rideTrip = (route: SavedRoute) => {
    goRef.current?.clear();
    setSavedTrip(route);
    offerSavedRoute(route);
  };

  const showRide = (picked: RideRecord) => {
    setViewedRide(picked);
    setExploring(true);
    setFollowGps(false);
    // Once the map has the screen, so it frames the ride at its real size.
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

  const dash = mode === 'dash';
  // The dash in view: the phone's state goes in the room round the dials (the
  // speedometer's corners in portrait, which need the speedometer; the dash's corners in
  // landscape). Anywhere else, the top line carries it.
  const onDash = dash && page === DASH && row === DASH_ROW;
  const cornersShown = onDash && (shows.speed || landscape);
  const marks = {
    network: networkMark(phoneStatus.network),
    gps: gpsState(fix, core.now),
    battery,
    headset: phoneStatus.headset,
    shows,
  };
  return (
    <div className="rc-device" data-status={nav.status} data-mode={dash ? undefined : mode}>
      {dash ? (
        <StatusLine
          core={core}
          battery={battery}
          shows={shows}
          weather={weather}
          network={marks.network}
          headset={marks.headset}
          gps={marks.gps}
          cornersShown={cornersShown}
        />
      ) : null}

      <Pager
        ref={pagerRef}
        axis="x"
        home={DASH}
        hold={hold}
        solo={!dash}
        onPage={changePage}
        returnAfterMs={RETURN_AFTER_MS}
        onReturn={() => goRef.current?.clear()}
      >
        <MusicPage active={page === MUSIC} onNote={(message, tone) => setToast({ message, tone })} />

        <Pager
          ref={columnRef}
          axis="y"
          home={DASH_ROW}
          hold={dash ? null : DASH_ROW}
          solo={!dash}
          onPage={setRow}
          returnAfterMs={RETURN_AFTER_MS}
        >
          <Page title="Settings" fill handle={{ edge: 'bottom', onBack: showDash }}>
            <SettingsPage
              layout={layout}
              onLayout={chooseLayout}
              keepOn={keepOn}
              onKeepOn={changeKeepOn}
              voiceOn={voiceOn}
              onVoice={changeVoice}
              dash={shows}
              onDash={changeShows}
            />
          </Page>

          <section className="rc-page rc-page-dash" aria-label="Dash">
            <main
              className="rc-cluster"
              data-speed={shows.speed ? undefined : 'off'}
              data-map={shows.map ? undefined : 'off'}
              data-trip={shows.trip ? undefined : 'off'}
            >
              {dash && shows.speed ? (
                <div className="rc-speed">
                  <SpeedDial speed={speedKmh(fix, core.now)} />
                  <StatusCorners place="speed" {...marks} />
                </div>
              ) : null}
              <MapZone
                core={core}
                mode={mode}
                followGps={dash || followGps}
                onFollowGps={setFollowGps}
                visible={!dash || (shows.map && page === DASH && row === DASH_ROW)}
                mapShown={shows.map}
                whereToShown={shows.whereTo}
                onOpen={openMap}
                onClose={closeMap}
                onWhereTo={whereTo}
                onFinish={finishTrip}
                viewedRide={viewedRide}
                routePanel={
                  choosingRoute ? (
                    <RoutePanel
                      core={core}
                      savedTrip={savedTrip}
                      options={routeOptions}
                      onOptions={changeRouteOptions}
                      onStart={start}
                      onCancel={finishTrip}
                      onRetry={retry}
                    />
                  ) : null
                }
              />
              {dash && shows.trip ? (
                <TripReadout
                  core={core}
                  media={shows.music ? media : null}
                  weather={shows.weather ? weather : null}
                  onMediaToggle={() => togglePlay(media)}
                />
              ) : null}
              {dash ? <StatusCorners place="cluster" {...marks} /> : null}
              {dash && !shows.speed && !shows.map && !shows.trip ? (
                <p className="rc-dash-hint">Swipe down to Settings to choose what the dash shows.</p>
              ) : null}
            </main>
          </section>

          <AppsPage
            onBack={showDash}
            active={page === DASH && row === APPS_ROW}
            onNote={(message, tone) => setToast({ message, tone })}
          />
        </Pager>

        {tripUnderway ? (
          <TripPage
            core={core}
            title={savedTrip?.name ?? core.trip.destination?.name ?? 'Trip'}
            voiceOn={voiceOn}
            onVoice={changeVoice}
            onEnd={finishTrip}
          />
        ) : (
          <GoPage
            ref={goRef}
            near={fix}
            searching={searching}
            onSearching={setSearching}
            active={page === GO}
            focusSearch={focusSearch}
            onPick={plan}
            onRideTrip={rideTrip}
          />
        )}

        <RidesPage active={page === RIDES} onShowRide={showRide} core={core} onRun={runRide} />
      </Pager>

      <TurnGlowEdges glow={glow} />

      {toast ? (
        <p className="rc-toast" data-tone={toast.tone} role="status">
          {toast.message}
        </p>
      ) : null}
    </div>
  );
}

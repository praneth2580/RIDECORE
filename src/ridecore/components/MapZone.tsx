import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  formatManeuverDistance,
  maneuverKind,
  mapService,
  MapView,
  navigationService,
  type RideRecord,
} from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import { CloseIcon, LocateIcon, SearchIcon } from './Icons';
import { ManeuverGlyph } from './ManeuverGlyph';

/**
 * dash: the map across the middle of the dash, edges faded into the black, a display
 * that always follows the rider and zooms with speed; swipes go through it to the
 * pages, a tap opens it. map: the map taking the screen,
 * to look around or at a ride. route: the map taking the screen to choose a route.
 */
export type ZoneMode = 'dash' | 'map' | 'route';

interface MapZoneProps {
  core: RideCoreState;
  mode: ZoneMode;
  followGps: boolean;
  onFollowGps: (follow: boolean) => void;
  /** False while another page is in view: the camera rests. */
  visible: boolean;
  /** The rider switched the dash's map off: only the turn, or Where to, shows there. */
  mapShown: boolean;
  /** The rider switched the dash's Where to button off. */
  whereToShown: boolean;
  /** The dash's map was tapped. */
  onOpen: () => void;
  /** The map taking the screen was closed. */
  onClose: () => void;
  onWhereTo: () => void;
  /** "Arrived" was tapped. */
  onFinish: () => void;
  viewedRide: RideRecord | null;
  /** Choosing a route: this panel over the map, in place of the turn banner. */
  routePanel?: ReactNode;
}

/** MapLibre takes its new size up to 50 ms after its box changes; routes are framed after that. */
const FIT_AFTER_RESIZE_MS = 80;

/** The live map, with the next turn over it. */
export function MapZone(props: MapZoneProps) {
  const { core, mode, followGps, onFollowGps, visible, mapShown, whereToShown, onOpen, onClose, onWhereTo, onFinish, viewedRide, routePanel } = props;
  const { fix, nav, trip } = core;
  const navMode = nav.status === 'navigating' || nav.status === 'rerouting';
  const zoneRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /** Tells the map what the banner, the buttons or the route panel cover, so the rider and routes stay clear. */
  const measure = useCallback(() => {
    const zone = zoneRef.current;
    const panel = panelRef.current;
    if (zone && panel) {
      // Down the left in landscape, along the bottom in portrait (ridecore.css).
      const beside = window.matchMedia('(orientation: landscape)').matches;
      const bottom = beside ? 0 : Math.max(0, zone.clientHeight - panel.offsetTop);
      mapService.setTopInset(0);
      mapService.setBottomInset(bottom);
      mapService.setSideInset(beside ? panel.offsetLeft + panel.offsetWidth : 0);
      zone.style.setProperty('--tc-credit-inset', `${bottom}px`);
      return;
    }
    const head = headRef.current;
    const foot = footRef.current;
    mapService.setTopInset(head && head.offsetHeight > 0 ? head.offsetTop + head.offsetHeight : 0);
    const bottom = zone && foot && foot.offsetHeight > 0 ? Math.max(0, zone.clientHeight - foot.offsetTop) : 0;
    mapService.setBottomInset(bottom);
    mapService.setSideInset(0);
    zone?.style.setProperty('--tc-credit-inset', `${bottom}px`);
  }, []);

  // Routes on offer: all of them in view, framed once the map has its size.
  const onOffer = nav.status === 'choosing' ? nav.alternatives : undefined;
  const offerRef = useRef(onOffer);
  const fitTimer = useRef<number>(undefined);
  useEffect(() => {
    offerRef.current = onOffer;
  });

  const fitOffer = useCallback(() => {
    window.clearTimeout(fitTimer.current);
    fitTimer.current = window.setTimeout(() => {
      const routes = offerRef.current;
      if (!routes || routes.length === 0) return;
      measure();
      mapService.fitRoute(routes.flatMap((route) => route.coordinates));
    }, FIT_AFTER_RESIZE_MS);
  }, [measure]);

  useEffect(() => () => window.clearTimeout(fitTimer.current), []);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      measure();
      // The map changed size under the routes on offer (the panel opening, the phone turning).
      if (offerRef.current) fitOffer();
    });
    for (const el of [zoneRef.current, headRef.current, footRef.current, panelRef.current]) if (el) observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [measure, fitOffer, nav.status, mode]);

  // The camera stops following while routes are on offer.
  useEffect(() => {
    if (!onOffer || onOffer.length === 0) return;
    onFollowGps(false);
    fitOffer();
  }, [onOffer, fitOffer, onFollowGps]);

  // The dash's map zooms with speed as navigation's does; looking around, the rider zooms.
  useEffect(() => {
    mapService.setFollowZoomBySpeed(mode === 'dash');
  }, [mode]);

  const recenter = () => {
    if (!fix) return;
    onFollowGps(true);
    if (navMode) mapService.resumeNavigationFollow();
    else mapService.centerOn([fix.longitude, fix.latitude]);
  };

  const instruction = nav.currentInstruction;
  const underway = (nav.status === 'navigating' || nav.status === 'rerouting' || nav.status === 'paused') && instruction;
  const arrived = nav.status === 'arrived';

  let banner: { glyph?: ReturnType<typeof maneuverKind>; title: string; text?: string } | null = null;
  if (underway) {
    banner = {
      glyph: maneuverKind(instruction),
      title: nav.distanceToNextManeuverMeters != null ? formatManeuverDistance(nav.distanceToNextManeuverMeters) : '—',
      text: nav.status === 'rerouting' ? 'Finding a new route' : nav.status === 'paused' ? 'Paused' : instruction.text,
    };
  } else if (arrived) {
    banner = { glyph: 'arrive', title: 'Arrived', text: `${trip.destination?.name ? `${trip.destination.name} · ` : ''}tap to finish` };
  }

  const bannerBody = banner ? (
    <>
      {banner.glyph ? <ManeuverGlyph kind={banner.glyph} /> : null}
      <div className="rc-banner-copy">
        <p className="rc-banner-title">{banner.title}</p>
        {banner.text ? <p className="rc-banner-text">{banner.text}</p> : null}
      </div>
    </>
  ) : null;

  return (
    <section
      ref={zoneRef}
      className="rc-zone"
      data-mode={mode}
      data-map={mode === 'dash' && !mapShown ? 'off' : undefined}
      aria-label="Map"
      onClick={mode === 'dash' ? onOpen : undefined}
    >
      <MapView
        fix={fix}
        visible={visible}
        followGps={followGps}
        navigating={navMode}
        routeMatch={nav.offRoute ? undefined : nav.matched}
        onFollowBreak={() => onFollowGps(false)}
        onRoutePick={(index) => {
          if (nav.status === 'choosing') navigationService.selectAlternative(index);
        }}
      />

      {routePanel ? (
        <div ref={panelRef} className="rc-zone-panel">
          {routePanel}
        </div>
      ) : (
        <>
          <div ref={headRef} className="rc-zone-head">
            {mode === 'map' ? (
              <button type="button" className="rc-zone-chip" onClick={onClose}>
                <CloseIcon /> {viewedRide?.name ?? 'Map'}
              </button>
            ) : null}
            {banner && arrived ? (
              <button
                type="button"
                className="rc-banner"
                data-glyph="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onFinish();
                }}
              >
                {bannerBody}
              </button>
            ) : banner ? (
              <div className="rc-banner" data-glyph={banner.glyph ? 'true' : undefined}>
                {bannerBody}
              </div>
            ) : null}
          </div>

          <div ref={footRef} className="rc-zone-foot">
            {mode === 'dash' && whereToShown && nav.status === 'idle' ? (
              <button
                type="button"
                className="rc-whereto"
                onClick={(e) => {
                  e.stopPropagation();
                  onWhereTo();
                }}
              >
                <SearchIcon /> Where to?
              </button>
            ) : null}
          </div>

          {mode === 'map' && !followGps && fix ? (
            <button type="button" className="rc-zone-recenter" aria-label="Back to me" onClick={recenter}>
              <LocateIcon />
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

import { useCallback, useEffect, useRef } from 'react';
import {
  formatDuration,
  formatKm,
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

interface MapZoneProps {
  core: RideCoreState;
  followGps: boolean;
  onFollowGps: (follow: boolean) => void;
  onWhereTo: () => void;
  viewedRide: RideRecord | null;
  onHideRide: () => void;
}

/** The middle of the device: the live map, with the next turn over it. */
export function MapZone({ core, followGps, onFollowGps, onWhereTo, viewedRide, onHideRide }: MapZoneProps) {
  const { fix, nav, trip } = core;
  const navMode = nav.status === 'navigating' || nav.status === 'rerouting';
  const zoneRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);

  /** Tells the map what the banner and the buttons cover, so the rider and routes stay clear. */
  const measure = useCallback(() => {
    const zone = zoneRef.current;
    const head = headRef.current;
    const foot = footRef.current;
    mapService.setTopInset(head && head.offsetHeight > 0 ? head.offsetTop + head.offsetHeight : 0);
    const bottom = zone && foot && foot.offsetHeight > 0 ? Math.max(0, zone.clientHeight - foot.offsetTop) : 0;
    mapService.setBottomInset(bottom);
    mapService.setSideInset(0);
    zone?.style.setProperty('--tc-credit-inset', `${bottom}px`);
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(measure);
    for (const el of [zoneRef.current, headRef.current, footRef.current]) if (el) observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [measure, nav.status]);

  // Routes on offer: all of them in view, and the camera stops following meanwhile.
  const onOffer = nav.status === 'choosing' ? nav.alternatives : undefined;
  useEffect(() => {
    if (!onOffer || onOffer.length === 0) return;
    onFollowGps(false);
    measure();
    mapService.fitRoute(onOffer.flatMap((route) => route.coordinates));
  }, [onOffer, measure, onFollowGps]);

  const recenter = () => {
    if (!fix) return;
    onFollowGps(true);
    if (navMode) mapService.resumeNavigationFollow();
    else mapService.centerOn([fix.longitude, fix.latitude]);
  };

  const instruction = nav.currentInstruction;
  const underway = (nav.status === 'navigating' || nav.status === 'rerouting' || nav.status === 'paused') && instruction;

  let banner: { glyph?: ReturnType<typeof maneuverKind>; title: string; text?: string } | null = null;
  if (underway) {
    banner = {
      glyph: maneuverKind(instruction),
      title: nav.distanceToNextManeuverMeters != null ? formatManeuverDistance(nav.distanceToNextManeuverMeters) : '—',
      text: nav.status === 'rerouting' ? 'Finding a new route' : nav.status === 'paused' ? 'Paused' : instruction.text,
    };
  } else if (nav.status === 'arrived') {
    banner = { glyph: 'arrive', title: 'Arrived', text: trip.destination?.name };
  } else if (nav.status === 'planning') {
    const percent = nav.progress?.percent;
    banner = { title: 'Planning', text: `${nav.message ?? 'Working…'}${percent != null ? ` · ${Math.round(percent)}%` : ''}` };
  } else if (nav.status === 'error') {
    banner = { title: 'No route', text: nav.message ?? 'Try again in a moment' };
  } else if (nav.status === 'choosing') {
    banner = { title: trip.destination?.name ?? 'Route', text: 'Pick a route, then Start' };
  }

  return (
    <section ref={zoneRef} className="rc-zone" aria-label="Map">
      <MapView
        fix={fix}
        followGps={followGps}
        navigating={navMode}
        routeMatch={nav.offRoute ? undefined : nav.matched}
        onFollowBreak={() => onFollowGps(false)}
        onRoutePick={(index) => {
          if (nav.status === 'choosing') navigationService.selectAlternative(index);
        }}
      />

      <div ref={headRef} className="rc-zone-head">
        {banner ? (
          <div className="rc-banner" data-glyph={banner.glyph ? 'true' : undefined}>
            {banner.glyph ? <ManeuverGlyph kind={banner.glyph} /> : null}
            <div className="rc-banner-copy">
              <p className="rc-banner-title">{banner.title}</p>
              {banner.text ? <p className="rc-banner-text">{banner.text}</p> : null}
            </div>
          </div>
        ) : null}
        {viewedRide ? (
          <button type="button" className="rc-zone-chip" onClick={onHideRide}>
            {viewedRide.name} <CloseIcon />
          </button>
        ) : null}
      </div>

      <div ref={footRef} className="rc-zone-foot">
        {nav.status === 'idle' && !viewedRide ? (
          <button type="button" className="rc-whereto" onClick={onWhereTo}>
            <SearchIcon /> Where to?
          </button>
        ) : null}
        {nav.status === 'choosing' && (nav.alternatives?.length ?? 0) > 1 ? (
          <div className="rc-routes" role="radiogroup" aria-label="Routes">
            {nav.alternatives!.map((route, index) => (
              <button
                key={route.id ?? index}
                type="button"
                role="radio"
                aria-checked={index === (nav.selectedAlternativeIndex ?? 0)}
                className="rc-route"
                onClick={() => navigationService.selectAlternative(index)}
              >
                <i style={{ background: mapService.alternativeColor(index) }} aria-hidden />
                <b>{formatDuration(route.durationSeconds)}</b>
                <span>{formatKm(route.distanceMeters)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!followGps && fix && nav.status !== 'choosing' ? (
        <button type="button" className="rc-zone-recenter" aria-label="Back to me" onClick={recenter}>
          <LocateIcon />
        </button>
      ) : null}
    </section>
  );
}

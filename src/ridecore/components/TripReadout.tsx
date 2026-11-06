import type { ReactNode } from 'react';
import { formatArrivalTime, formatDuration, formatKm, navigationService, rideLogService } from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import type { NowPlaying } from '../media';
import type { Weather } from '../weather';
import { clock, day, timer } from '../format';
import { MusicIcon, PauseIcon, PlayIcon, RadioIcon, WeatherIcon } from './Icons';

interface Readout {
  kind: 'trip' | 'ride' | 'music' | 'weather' | 'clock';
  label: string;
  value: string;
  detail?: ReactNode;
  /** 0–1 along the trip, or null for no scale. */
  progress: number | null;
  icon?: ReactNode;
}

interface TripReadoutProps {
  core: RideCoreState;
  /** What plays, if the rider shows it here; tapped, it pauses or plays. */
  media: NowPlaying | null;
  weather: Weather | null;
  onMediaToggle: () => void;
}

/**
 * The most useful thing right now: the trip, else the ride, else what plays, else the
 * weather, else the time. Routes on offer have the route panel.
 */
function readout({ core, media, weather }: TripReadoutProps): Readout {
  const { nav, ride, now } = core;
  if (nav.status === 'navigating' || nav.status === 'rerouting' || nav.status === 'paused') {
    const seconds = nav.remainingDurationSeconds ?? 0;
    const remaining = nav.remainingDistanceMeters ?? 0;
    const total = navigationService.getActiveCalculatedRoute()?.distanceMeters ?? remaining;
    return {
      kind: 'trip',
      label: `Arrive ${formatArrivalTime(now + seconds * 1000)}`,
      value: formatDuration(seconds),
      detail: formatKm(remaining),
      progress: total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0,
    };
  }
  if (ride) {
    return {
      kind: 'ride',
      label: ride.state === 'paused' ? 'Ride paused' : 'Riding',
      value: formatKm(ride.distanceMeters),
      detail: timer(rideLogService.activeSeconds()),
      progress: null,
    };
  }
  if (media) {
    return {
      kind: 'music',
      label: media.loading ? 'Tuning in…' : (media.subtitle ?? (media.source === 'radio' ? 'Radio' : 'Music')),
      value: media.title,
      detail: media.playing || media.loading ? <PauseIcon /> : <PlayIcon />,
      progress: null,
      icon: media.source === 'radio' ? <RadioIcon /> : <MusicIcon />,
    };
  }
  if (weather) {
    return {
      kind: 'weather',
      label: weather.label,
      value: `${Math.round(weather.tempC)}°`,
      detail: weather.rainChance != null ? `Rain ${weather.rainChance}%` : undefined,
      progress: null,
      icon: <WeatherIcon kind={weather.kind} />,
    };
  }
  return { kind: 'clock', label: day(now), value: clock(now), progress: null };
}

/** A dial on the right in landscape, a line under the road in portrait (ridecore.css). */
export function TripReadout(props: TripReadoutProps) {
  const { kind, label, value, detail, progress, icon } = readout(props);
  const body = (
    <>
      <span className="rc-trip-label">
        {icon ? <i className="rc-trip-icon">{icon}</i> : null}
        {label}
      </span>
      <span className="rc-trip-value">{value}</span>
      {detail ? <span className="rc-trip-detail">{detail}</span> : null}
      {progress != null ? (
        <span className="rc-trip-scale" style={{ ['--p' as string]: progress }} aria-label={`${Math.round(progress * 100)}% of the way`}>
          <i />
        </span>
      ) : null}
    </>
  );
  // What plays: the readout is its play and pause.
  return kind === 'music' ? (
    <button type="button" className="rc-trip" data-kind={kind} aria-label={`${value}: play or pause`} onClick={props.onMediaToggle}>
      {body}
    </button>
  ) : (
    <div className="rc-trip" data-kind={kind}>
      {body}
    </div>
  );
}

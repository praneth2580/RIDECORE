import { useState, type MouseEvent, type ReactNode } from 'react';
import { formatArrivalTime, formatDuration, formatKm, navigationService, rideLogService } from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import { canSkip, skip, togglePlay, type NowPlaying } from '../media';
import type { Weather } from '../weather';
import { useDashFace, type Face } from '../faces';
import { clock, day, timer } from '../format';
import { MusicIcon, NextIcon, PauseIcon, PlayIcon, PreviousIcon, RadioIcon, WeatherIcon } from './Icons';

interface Readout {
  label: string;
  value: string;
  detail?: ReactNode;
  /** 0–1 along the trip, or null for no scale. */
  progress: number | null;
  icon?: ReactNode;
}

interface TripReadoutProps {
  core: RideCoreState;
  /** What plays, if the rider shows it here. */
  media: NowPlaying | null;
  weather: Weather | null;
}

/** The trip, the ride, the weather or the time, as a face of the dial. */
function readout(face: Exclude<Face, 'music'>, { nav, ride, now }: RideCoreState, weather: Weather | null): Readout {
  if (face === 'trip') {
    const seconds = nav.remainingDurationSeconds ?? 0;
    const remaining = nav.remainingDistanceMeters ?? 0;
    const total = navigationService.getActiveCalculatedRoute()?.distanceMeters ?? remaining;
    return {
      label: `Arrive ${formatArrivalTime(now + seconds * 1000)}`,
      value: formatDuration(seconds),
      detail: formatKm(remaining),
      progress: total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0,
    };
  }
  if (face === 'ride' && ride) {
    return {
      label: ride.state === 'paused' ? 'Ride paused' : 'Riding',
      value: formatKm(ride.distanceMeters),
      detail: timer(rideLogService.activeSeconds()),
      progress: null,
    };
  }
  if (face === 'weather' && weather) {
    return {
      label: weather.label,
      value: `${Math.round(weather.tempC)}°`,
      detail: weather.rainChance != null ? `Rain ${weather.rainChance}%` : undefined,
      progress: null,
      icon: <WeatherIcon kind={weather.kind} />,
    };
  }
  return { label: day(now), value: clock(now), progress: null };
}

/**
 * The dash's right dial in landscape, a line under the road in portrait (ridecore.css):
 * one face at a time, the trip, the ride, what plays, the weather or the time (faces.ts).
 * A tap steps to the next, its dots showing which; on the music face, its keys play,
 * pause and skip instead.
 */
export function TripReadout({ core, media, weather }: TripReadoutProps) {
  const { nav, ride } = core;
  const { face, available, next } = useDashFace({
    trip: nav.status === 'navigating' || nav.status === 'rerouting' || nav.status === 'paused',
    ride: Boolean(ride),
    music: Boolean(media),
    musicPlaying: Boolean(media && (media.playing || media.loading)),
    weather: Boolean(weather),
  });
  const steps = available.length > 1;
  const music = face === 'music' && media ? media : null;
  return (
    <div className="rc-trip" data-kind={face} data-steps={steps ? 'true' : undefined} onClick={steps ? next : undefined}>
      {music ? <MusicFace media={music} /> : <ReadoutFace {...readout(face === 'music' ? 'clock' : face, core, weather)} />}
      {steps ? (
        <ol className="rc-trip-dots" aria-hidden>
          {available.map((one) => (
            <li key={one} data-on={one === face ? 'true' : undefined} />
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function ReadoutFace({ label, value, detail, progress, icon }: Readout) {
  return (
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
}

/**
 * What plays: the cover (the whole dial in landscape), the song and who sings it, and
 * keys to go back, play or pause, and skip, as a car stereo has them. Bars move while
 * it plays.
 */
function MusicFace({ media }: { media: NowPlaying }) {
  const [brokenArt, setBrokenArt] = useState<string | null>(null);
  const on = Boolean(media.playing || media.loading);
  const radio = media.source === 'radio';
  const art = media.art && media.art !== brokenArt ? media.art : null;
  const label = media.loading ? 'Tuning in…' : (media.error ?? media.subtitle ?? (radio ? 'Radio' : 'Music'));
  // A key works the music; a tap anywhere else on the dial steps to the next face.
  const key = (work: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    work();
  };
  return (
    <>
      {/* A song's cover fills the dial; a station's logo is too small for that. */}
      <span className="rc-trip-art" data-cover={art && !radio ? 'true' : undefined}>
        {art ? (
          <img key={art} src={art} alt="" draggable={false} onError={() => setBrokenArt(art)} />
        ) : radio ? (
          <RadioIcon />
        ) : (
          <MusicIcon />
        )}
      </span>
      <span className="rc-trip-label" data-tone={media.error ? 'error' : undefined}>
        {media.playing ? (
          <span className="rc-eq" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        ) : (
          <i className="rc-trip-icon">{radio ? <RadioIcon /> : <MusicIcon />}</i>
        )}
        {label}
      </span>
      <span className="rc-trip-value">{media.title}</span>
      <span className="rc-trip-keys">
        {canSkip(media) ? (
          <button type="button" className="rc-trip-skip" data-dir="previous" aria-label="Back" onClick={key(() => skip(media, 'previous'))}>
            <PreviousIcon />
          </button>
        ) : null}
        <button type="button" className="rc-trip-play" aria-label={on ? 'Pause' : 'Play'} onClick={key(() => togglePlay(media))}>
          {on ? <PauseIcon /> : <PlayIcon />}
        </button>
        {canSkip(media) ? (
          <button type="button" className="rc-trip-skip" data-dir="next" aria-label="Next" onClick={key(() => skip(media, 'next'))}>
            <NextIcon />
          </button>
        ) : null}
      </span>
    </>
  );
}

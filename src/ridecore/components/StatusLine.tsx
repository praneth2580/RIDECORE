import { formatKm, gpsWarning, isFixStale } from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import type { Battery } from '../app/useBattery';
import { clock, compassPoint, day } from '../format';

/** The device's top line: time, date, heading, recording, GPS, battery. Small and quiet. */
export function StatusLine({ core, battery }: { core: RideCoreState; battery: Battery | null }) {
  const { fix, compass, ride, now } = core;
  const heading = fix?.headingDegrees ?? compass?.headingDegrees ?? null;
  const gps = !fix ? 'none' : isFixStale(fix, now) ? 'lost' : (gpsWarning(fix, now) ?? 'ok');

  return (
    <header className="rc-statusline">
      <span className="rc-statusline-time">{clock(now)}</span>
      <span className="rc-statusline-date">{day(now)}</span>
      {heading != null ? <span className="rc-statusline-heading">{compassPoint(heading)}</span> : null}
      <span className="rc-statusline-gap" />
      {ride ? (
        <span className="rc-statusline-rec" data-state={ride.state}>
          <i aria-hidden /> REC {formatKm(ride.distanceMeters)}
        </span>
      ) : null}
      <span className="rc-statusline-gps" data-state={gps} aria-label={`GPS ${gps}`}>
        <i aria-hidden /> GPS
      </span>
      {battery ? (
        <span>
          {battery.charging ? '⚡' : ''}
          {Math.round(battery.level * 100)}%
        </span>
      ) : null}
    </header>
  );
}

import { formatKm, gpsWarning, isFixStale } from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import type { Battery } from '../app/useBattery';
import type { DashShows } from '../dash';
import { clock, compassPoint, day } from '../format';
import { RAIN_WARN_CHANCE, type Weather } from '../weather';
import { RainIcon, WeatherIcon } from './Icons';

interface StatusLineProps {
  core: RideCoreState;
  battery: Battery | null;
  /** What the rider chose to see. A ride being recorded always shows. */
  shows: DashShows;
  weather: Weather | null;
}

/** The device's top line: time, date, heading, weather, recording, GPS, battery. Small and quiet. */
export function StatusLine({ core, battery, shows, weather }: StatusLineProps) {
  const { fix, compass, ride, now } = core;
  const heading = shows.heading ? (fix?.headingDegrees ?? compass?.headingDegrees ?? null) : null;
  const gps = !fix ? 'none' : isFixStale(fix, now) ? 'lost' : (gpsWarning(fix, now) ?? 'ok');
  const power = shows.battery ? battery : null;

  return (
    <header className="rc-statusline">
      {shows.clock ? (
        <>
          <span className="rc-statusline-time">{clock(now)}</span>
          <span className="rc-statusline-date">{day(now)}</span>
        </>
      ) : null}
      {heading != null ? <span className="rc-statusline-heading">{compassPoint(heading)}</span> : null}
      {shows.topWeather && weather ? (
        <span className="rc-statusline-weather" aria-label={`${weather.label}, ${Math.round(weather.tempC)} degrees`}>
          <WeatherIcon kind={weather.kind} />
          {Math.round(weather.tempC)}°
          {weather.rainChance != null && weather.rainChance >= RAIN_WARN_CHANCE ? (
            <b className="rc-statusline-rain" aria-label={`Rain ${weather.rainChance}%`}>
              <RainIcon />
              {weather.rainChance}%
            </b>
          ) : null}
        </span>
      ) : null}
      <span className="rc-statusline-gap" />
      {ride ? (
        <span className="rc-statusline-rec" data-state={ride.state}>
          <i aria-hidden /> REC {formatKm(ride.distanceMeters)}
        </span>
      ) : null}
      {shows.gps ? (
        <span className="rc-statusline-gps" data-state={gps} aria-label={`GPS ${gps}`}>
          <i aria-hidden /> GPS
        </span>
      ) : null}
      {power ? (
        <span>
          {power.charging ? '⚡' : ''}
          {Math.round(power.level * 100)}%
        </span>
      ) : null}
    </header>
  );
}

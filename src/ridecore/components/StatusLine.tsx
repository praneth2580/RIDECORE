import { formatKm } from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import type { Battery } from '../app/useBattery';
import type { DashShows } from '../dash';
import type { PhoneHeadset } from '../device';
import { clock, compassPoint, day, type GpsState } from '../format';
import type { NetworkMark } from '../status';
import { RAIN_WARN_CHANCE, type Weather } from '../weather';
import { RainIcon, WeatherIcon } from './Icons';
import { BatteryMark, GpsMark, HeadsetMark, NetworkMarkView } from './StatusMarks';

interface StatusLineProps {
  core: RideCoreState;
  battery: Battery | null;
  /** What the rider chose to see. A ride being recorded always shows. */
  shows: DashShows;
  weather: Weather | null;
  network: NetworkMark | null;
  headset: PhoneHeadset | undefined;
  gps: GpsState;
  /**
   * The dash in view, with the phone's state in its corners: the top line keeps to the
   * time, heading, weather and recording. Elsewhere it carries the phone's state too.
   */
  cornersShown: boolean;
}

/** The device's top line: time, date, heading, weather, recording; away from the dash, the phone's state. */
export function StatusLine({ core, battery, shows, weather, network, headset, gps, cornersShown }: StatusLineProps) {
  const { fix, compass, ride, now } = core;
  const heading = shows.heading ? (fix?.headingDegrees ?? compass?.headingDegrees ?? null) : null;
  const phone = !cornersShown;

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
      {phone && shows.network && network ? <NetworkMarkView mark={network} compact /> : null}
      {phone && shows.headset ? <HeadsetMark headset={headset} compact /> : null}
      {phone && shows.gps ? <GpsMark state={gps} compact /> : null}
      {phone && shows.battery && battery ? <BatteryMark battery={battery} compact /> : null}
    </header>
  );
}

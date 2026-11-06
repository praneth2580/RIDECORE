import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';

/**
 * The weather where the rider is, from Open-Meteo (open-meteo.com: free, no key). What
 * matters on a bike: the temperature, what it's doing, and whether rain is coming in the
 * next few hours. The position sent is rounded to about 5 km.
 */
export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export interface Weather {
  tempC: number;
  kind: WeatherKind;
  /** In a word or two: "Clear", "Light rain". */
  label: string;
  /** The highest chance of rain over the next three hours, 0–100; null if not given. */
  rainChance: number | null;
  windKmh: number | null;
}

/** From here a rider wants to know: the top line shows the umbrella. */
export const RAIN_WARN_CHANCE = 40;
const REFRESH_MS = 15 * 60_000;
/** Positions are rounded to this (degrees, about 5 km), so moving across town doesn't fetch again. */
const GRID_DEG = 0.05;

/** WMO weather codes, as Open-Meteo gives them. */
export function describeWeather(code: number): { kind: WeatherKind; label: string } {
  if (code === 0) return { kind: 'clear', label: 'Clear' };
  if (code === 1 || code === 2) return { kind: 'cloudy', label: 'Partly cloudy' };
  if (code === 3) return { kind: 'cloudy', label: 'Cloudy' };
  if (code === 45 || code === 48) return { kind: 'fog', label: 'Fog' };
  if (code >= 51 && code <= 57) return { kind: 'drizzle', label: 'Drizzle' };
  if (code === 61 || code === 80) return { kind: 'rain', label: 'Light rain' };
  if ((code >= 62 && code <= 67) || code === 81) return { kind: 'rain', label: 'Rain' };
  if (code === 82) return { kind: 'rain', label: 'Heavy rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: 'snow', label: 'Snow' };
  if (code >= 95) return { kind: 'storm', label: 'Thunderstorm' };
  return { kind: 'cloudy', label: 'Cloudy' };
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Open-Meteo's answer as what the dash shows; null if it isn't one. */
export function parseWeather(raw: unknown): Weather | null {
  if (!raw || typeof raw !== 'object') return null;
  const current = (raw as { current?: Record<string, unknown> }).current;
  const tempC = finite(current?.temperature_2m);
  const code = finite(current?.weather_code);
  if (tempC == null || code == null) return null;
  const hourly = (raw as { hourly?: { precipitation_probability?: unknown } }).hourly;
  const chances = Array.isArray(hourly?.precipitation_probability)
    ? hourly.precipitation_probability.map(finite).filter((n): n is number => n != null)
    : [];
  return {
    tempC,
    ...describeWeather(code),
    rainChance: chances.length > 0 ? Math.max(...chances) : null,
    windKmh: finite(current?.wind_speed_10m),
  };
}

/** Where to ask about: the position on a ~5 km grid. */
export function weatherSpot(latitude: number, longitude: number): string {
  const snap = (n: number) => (Math.round(n / GRID_DEG) * GRID_DEG).toFixed(2);
  return `${snap(latitude)},${snap(longitude)}`;
}

async function fetchWeather(spot: string): Promise<Weather | null> {
  const [latitude, longitude] = spot.split(',');
  const params = new URLSearchParams({
    latitude: latitude!,
    longitude: longitude!,
    current: 'temperature_2m,weather_code,wind_speed_10m',
    hourly: 'precipitation_probability',
    forecast_hours: '3',
    timezone: 'auto',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) return null;
  return parseWeather(await response.json());
}

/**
 * The weather at the rider's spot, read again every 15 minutes, on coming back to
 * RIDECORE, and on riding into the next spot. Null until known, or while off.
 */
export function useWeather(position: { latitude: number; longitude: number } | null, on: boolean): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  const spot = on && position ? weatherSpot(position.latitude, position.longitude) : null;

  useEffect(() => {
    if (!spot) return;
    let live = true;
    const read = () =>
      void fetchWeather(spot)
        .then((next) => live && next && setWeather(next))
        .catch(() => undefined);
    read();
    const timer = window.setInterval(read, REFRESH_MS);
    const resume = CapacitorApp.addListener('resume', read);
    return () => {
      live = false;
      window.clearInterval(timer);
      void resume.then((l) => l.remove());
    };
  }, [spot]);

  return on ? weather : null;
}

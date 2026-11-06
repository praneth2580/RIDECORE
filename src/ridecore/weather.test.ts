import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/app', () => ({ App: {} }));
const { describeWeather, parseWeather, weatherSpot } = await import('./weather');

describe('the weather', () => {
  it('reads Open-Meteo: temperature, what it does, the most rain chance ahead', () => {
    const raw = {
      current: { temperature_2m: 31.4, weather_code: 61, wind_speed_10m: 12.5 },
      hourly: { precipitation_probability: [20, 65, null, 40] },
    };
    expect(parseWeather(raw)).toEqual({ tempC: 31.4, kind: 'rain', label: 'Light rain', rainChance: 65, windKmh: 12.5 });
  });

  it('has no rain chance when none is given, and nothing from junk', () => {
    expect(parseWeather({ current: { temperature_2m: 20, weather_code: 0 } })).toMatchObject({ rainChance: null, windKmh: null, kind: 'clear' });
    expect(parseWeather({ current: { temperature_2m: 'hot' } })).toBeNull();
    expect(parseWeather(null)).toBeNull();
  });

  it('puts WMO codes in words', () => {
    expect(describeWeather(0).label).toBe('Clear');
    expect(describeWeather(3).kind).toBe('cloudy');
    expect(describeWeather(45).kind).toBe('fog');
    expect(describeWeather(82).label).toBe('Heavy rain');
    expect(describeWeather(95).kind).toBe('storm');
    expect(describeWeather(7).kind).toBe('cloudy');
  });

  it('asks about a spot about 5 km across, not the exact position', () => {
    expect(weatherSpot(19.1663, 72.8526)).toBe('19.15,72.85');
    expect(weatherSpot(19.1663, 72.8526)).toBe(weatherSpot(19.17, 72.86));
    expect(weatherSpot(19.1663, 72.8526)).not.toBe(weatherSpot(19.25, 72.86));
  });
});

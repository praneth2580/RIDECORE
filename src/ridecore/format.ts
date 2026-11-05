import { isFixStale, type GpsFix } from './engine';

/** Speed in km/h, or null with no fix, a stale fix, or no speed in it. */
export function speedKmh(fix: GpsFix | null, now: number): number | null {
  if (!fix || fix.speedMps == null || isFixStale(fix, now)) return null;
  return Math.max(0, fix.speedMps * 3.6);
}

const clockFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** "16:09" or "4:09 pm", as the phone tells time. */
export function clock(now: number): string {
  return clockFormat.format(now);
}

/** "Tue, 16 Sep" */
export function day(now: number): string {
  return dayFormat.format(now);
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** "NE" for 40°. */
export function compassPoint(degrees: number): string {
  return POINTS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]!;
}

/** "1:05:09" or "5:09": a ride's running time. */
export function timer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "84 MB" */
export function bytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

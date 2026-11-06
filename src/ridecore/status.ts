import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { device, NO_PHONE_STATUS, type PhoneHeadset, type PhoneNetwork, type PhoneStatus } from './device';

/**
 * The phone's state for the dash's corners, each shown only when it means something: the
 * signal if there's a SIM, Wi-Fi if on it, "Offline" or airplane mode if that's how it
 * is, a headset if one is connected. A word appears only when something is wrong.
 */
export interface NetworkMark {
  kind: 'signal' | 'wifi' | 'offline' | 'airplane';
  /** Bars, 0–4, for the SIM's signal; null when the phone won't say. */
  level: number | null;
  /** Only when something's wrong: "No signal", "No internet", "Offline". */
  warning?: string;
  /** For screen readers: the whole story. */
  label: string;
}

export function networkMark(network: PhoneNetwork | undefined): NetworkMark | null {
  if (!network) return null;
  if (network.airplane && !network.wifi) return { kind: 'airplane', level: null, warning: 'Airplane', label: 'Airplane mode' };
  if (network.wifi) {
    return network.online
      ? { kind: 'wifi', level: null, label: 'Wi-Fi' }
      : { kind: 'wifi', level: null, warning: 'No internet', label: 'Wi-Fi, no internet' };
  }
  if (network.sim) {
    const level = network.level ?? null;
    const name = network.operator ?? 'Mobile';
    if (level === 0) return { kind: 'signal', level, warning: 'No signal', label: `${name}: no signal` };
    if (!network.online) return { kind: 'signal', level, warning: 'No internet', label: `${name}: no internet` };
    return { kind: 'signal', level, label: level == null ? name : `${name}: ${level} of 4 bars` };
  }
  return network.online ? null : { kind: 'offline', level: null, warning: 'Offline', label: 'Offline: no SIM or Wi-Fi' };
}

/** The headset's name, or what it is; null with none connected. */
export function headsetName(headset: PhoneHeadset | undefined): string | null {
  if (!headset?.connected) return null;
  return headset.name ?? (headset.kind === 'bluetooth' ? 'Bluetooth' : 'Headset');
}

/** Read again this often while the dash shows: the signal level isn't pushed. */
const REFRESH_MS = 15_000;

/** The phone's state, kept current; `active` while the dash shows, to follow the signal. */
export function usePhoneStatus(active: boolean): PhoneStatus {
  const [status, setStatus] = useState<PhoneStatus>(NO_PHONE_STATUS);

  useEffect(() => {
    let live = true;
    const read = () =>
      void device
        .getStatus()
        .then((next) => live && setStatus(next))
        .catch(() => undefined);
    read();
    const changes = device.addListener('status', (next) => live && setStatus(next));
    const resume = CapacitorApp.addListener('resume', read);
    const timer = active ? window.setInterval(read, REFRESH_MS) : undefined;
    return () => {
      live = false;
      window.clearInterval(timer);
      void changes.then((l) => l.remove());
      void resume.then((l) => l.remove());
    };
  }, [active]);

  return status;
}

/** True while the media query matches, e.g. '(orientation: landscape)'. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const change = () => setMatches(list.matches);
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, [query]);
  return matches;
}

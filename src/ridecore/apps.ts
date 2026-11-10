/**
 * The phone's apps, in two screens below the dash: the few the rider picked, as big
 * keys a swipe up, and every app, the drawer, a swipe further. Holding an app in either
 * puts it on the picked screen or takes it off.
 */
import { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { device, type PhoneApp } from './device';

/** A screenful of big keys, either way up: two across and four down, or four by two. */
export const PICKS_MAX = 8;

// The key the drawer's pins were kept under: they're the first picks.
const PICKS_KEY = 'ridecore.pinnedApps';

/** The picked apps' packages, in the order they were picked. */
export function loadPicks(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PICKS_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    const names = saved.filter((item): item is string => typeof item === 'string');
    return [...new Set(names)].slice(0, PICKS_MAX);
  } catch {
    return [];
  }
}

export type PickChange = 'added' | 'removed' | 'full';

/** On the picked screen if it wasn't, off if it was; full leaves it as it is. */
export function togglePick(picks: string[], packageName: string): { picks: string[]; change: PickChange } {
  if (picks.includes(packageName)) {
    return { picks: picks.filter((name) => name !== packageName), change: 'removed' };
  }
  if (picks.length >= PICKS_MAX) return { picks, change: 'full' };
  return { picks: [...picks, packageName], change: 'added' };
}

/**
 * The picked apps still on the phone, in the order picked. An app with two ways in
 * shows once, by its first.
 */
export function pickedApps(apps: PhoneApp[], picks: string[]): PhoneApp[] {
  return picks.flatMap((name) => {
    const app = apps.find((candidate) => candidate.packageName === name);
    return app ? [app] : [];
  });
}

/** What the rider is told after holding an app. */
export function pickNote(app: PhoneApp, change: PickChange, count: number): string {
  if (change === 'full') return `Apps is full at ${PICKS_MAX}: hold one of them to take it off first`;
  if (change === 'removed') return `${app.label} taken off Apps`;
  return `${app.label} on Apps (${count} of ${PICKS_MAX})`;
}

export interface PhoneApps {
  /** False in a browser, which has no apps to list. */
  supported: boolean;
  /** Every app, A to Z; null while they're first read. */
  apps: PhoneApp[] | null;
  /** The picked apps' packages, picked order. */
  picks: string[];
  /** Holding an app: on or off the picked screen, and the picks after. */
  toggle: (app: PhoneApp) => { picks: string[]; change: PickChange };
}

/**
 * The phone's apps for both screens, read when either comes into view and again on
 * coming back to RIDECORE (apps put on or taken off while it was away).
 */
export function usePhoneApps(active: boolean): PhoneApps {
  const [apps, setApps] = useState<PhoneApp[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [picks, setPicks] = useState(loadPicks);

  const load = useCallback(() => {
    device
      .listApps()
      .then((result) => {
        setSupported(result.supported);
        setApps([...result.apps].sort((a, b) => a.label.localeCompare(b.label)));
      })
      .catch(() => setApps([]));
  }, []);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  useEffect(() => {
    const listener = CapacitorApp.addListener('resume', load);
    return () => void listener.then((l) => l.remove());
  }, [load]);

  const toggle = (app: PhoneApp) => {
    const next = togglePick(picks, app.packageName);
    if (next.change !== 'full') {
      localStorage.setItem(PICKS_KEY, JSON.stringify(next.picks));
      setPicks(next.picks);
    }
    return next;
  };

  return { supported, apps, picks, toggle };
}

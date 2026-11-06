import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { device, type PhoneApp } from '../device';
import { Empty } from '../components/Empty';
import { GridIcon } from '../components/Icons';
import { Page } from '../components/Page';

interface AppsPageProps {
  /** In view: the apps are read, and read again on coming back to RIDECORE. */
  active: boolean;
  /** Something to tell the rider: an app pinned, or one that wouldn't open. */
  onNote: (message: string, tone: 'info' | 'error') => void;
  /** Back down to the dash, from the handle at the top. */
  onBack: () => void;
}

const PINNED_KEY = 'ridecore.pinnedApps';

function loadPinned(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The phone's other apps, as a home screen's app drawer: swipe up from the dash, tap
 * one to open it. Holding one pins it to the top, for music, calls and the like.
 */
export function AppsPage({ active, onNote, onBack }: AppsPageProps) {
  const [apps, setApps] = useState<PhoneApp[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [pinned, setPinned] = useState(loadPinned);

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

  // Apps put on or taken off the phone while RIDECORE was away.
  useEffect(() => {
    const listener = CapacitorApp.addListener('resume', load);
    return () => void listener.then((l) => l.remove());
  }, [load]);

  const open = (app: PhoneApp) => {
    device.openApp({ packageName: app.packageName, activity: app.activity }).catch((e: unknown) => onNote(e instanceof Error ? e.message : "That app wouldn't open", 'error'));
  };

  // A long press: Android's browser calls it a context menu.
  const togglePin = (event: MouseEvent, app: PhoneApp) => {
    event.preventDefault();
    const on = !pinned.includes(app.packageName);
    const next = on ? [...pinned, app.packageName] : pinned.filter((name) => name !== app.packageName);
    localStorage.setItem(PINNED_KEY, JSON.stringify(next));
    setPinned(next);
    onNote(on ? `${app.label} pinned to the top` : `${app.label} unpinned`, 'info');
  };

  const grid = (list: PhoneApp[]) => (
    <ul className="rc-apps">
      {list.map((app) => (
        <li key={`${app.packageName}/${app.activity ?? ''}`}>
          <button type="button" className="rc-app" onClick={() => open(app)} onContextMenu={(e) => togglePin(e, app)}>
            {app.icon ? <img src={app.icon} alt="" draggable={false} /> : <i aria-hidden>{app.label.slice(0, 1)}</i>}
            <span>{app.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  const pinnedApps = (apps ?? []).filter((app) => pinned.includes(app.packageName));

  return (
    <Page title="Apps" fill handle={{ edge: 'top', onBack }}>
      {!supported ? (
        <Empty icon={<GridIcon />} title="On the phone only" text="As the phone's home screen, RIDECORE lists its apps here to open them." />
      ) : !apps ? (
        <p className="rc-note">Loading apps…</p>
      ) : apps.length === 0 ? (
        <Empty icon={<GridIcon />} title="No apps" text="Nothing else on this phone opens from a home screen." />
      ) : (
        <>
          {pinnedApps.length > 0 ? (
            <>
              <h3 className="rc-section">Pinned</h3>
              {grid(pinnedApps)}
              <h3 className="rc-section">All apps</h3>
            </>
          ) : null}
          {grid(apps)}
          <p className="rc-note" data-center>
            {pinnedApps.length > 0 ? 'Hold an app to pin or unpin it' : 'Hold an app to pin it to the top'}
          </p>
        </>
      )}
    </Page>
  );
}

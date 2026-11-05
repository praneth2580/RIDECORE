import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { mapPackService, mapService, rideLogService, voiceGuidance, type MapPackMeta } from '../engine';
import { device, type HomeStatus, type Layout } from '../device';
import { Empty } from '../components/Empty';
import { bytes } from '../format';
import { LayoutPicture } from './ChooseLayout';

interface SettingsPageProps {
  layout: Layout;
  onLayout: (layout: Layout) => void;
  keepOn: boolean;
  onKeepOn: (on: boolean) => void;
}

/** How the phone shows RIDECORE, how RIDECORE rides, and the maps it keeps. */
export function SettingsPage({ layout, onLayout, keepOn, onKeepOn }: SettingsPageProps) {
  const [voiceOn, setVoiceOn] = useState(() => voiceGuidance.isEnabled());
  const [autoRecord, setAutoRecord] = useState(() => rideLogService.getAutoRecord());
  const [pins, setPins] = useState(() => mapService.overlaysOnMap());

  return (
    <>
      <h3 className="rc-section">Screen</h3>
      <div className="rc-layout-choice" role="radiogroup" aria-label="Screen layout">
        {(['landscape', 'portrait'] as const).map((option) => (
          <button key={option} type="button" role="radio" aria-checked={layout === option} onClick={() => onLayout(option)}>
            <LayoutPicture layout={option} />
            <b>{option === 'landscape' ? 'Landscape' : 'Portrait'}</b>
          </button>
        ))}
      </div>
      <div className="rc-tile rc-settings">
        <Toggle label="Keep the screen on" hint="Always, not only while navigating" on={keepOn} onChange={onKeepOn} />
      </div>

      <h3 className="rc-section">Home screen</h3>
      <HomeScreen />

      <h3 className="rc-section">Riding</h3>
      <div className="rc-tile rc-settings">
        <Toggle
          label="Voice guidance"
          hint="Spoken turns while navigating"
          on={voiceOn}
          onChange={(on) => {
            voiceGuidance.setEnabled(on);
            setVoiceOn(on);
          }}
        />
        <Toggle
          label="Fuel and food on the map"
          hint="Petrol pumps and places to eat, as pins"
          on={pins}
          onChange={(on) => {
            mapService.setOverlaysShown(on);
            setPins(on);
          }}
        />
        <Toggle
          label="Record every trip"
          hint="Starts recording when navigation starts"
          on={autoRecord}
          onChange={(on) => {
            rideLogService.setAutoRecord(on);
            setAutoRecord(on);
          }}
        />
      </div>

      <h3 className="rc-section">Maps on this phone</h3>
      <MapsOnPhone />

      <h3 className="rc-section">Phone</h3>
      <div className="rc-tile rc-settings">
        <button type="button" className="rc-toggle" onClick={() => void device.openSettings()}>
          <span>
            <b>Android settings</b>
            <small>Wi-Fi, Bluetooth, sound and the rest of the phone</small>
          </span>
          <em aria-hidden>›</em>
        </button>
      </div>
    </>
  );
}

/** Whether Home opens RIDECORE, checked again on coming back from Android's settings. */
function HomeScreen() {
  const [status, setStatus] = useState<HomeStatus | null>(null);

  useEffect(() => {
    const check = () =>
      void device
        .getHomeStatus()
        .then(setStatus)
        .catch(() => setStatus({ supported: false, isHome: false }));
    check();
    const listener = CapacitorApp.addListener('resume', check);
    return () => void listener.then((l) => l.remove());
  }, []);

  if (!status) return <p className="rc-note">Checking…</p>;
  if (!status.supported) {
    return <Empty title="On the phone only" text="Installed on Android, RIDECORE can be the home screen: Home and switching the phone on always open it." />;
  }
  return (
    <div className="rc-tile rc-home" data-home={status.isHome ? 'true' : undefined}>
      <div className="rc-item-text">
        <p className="rc-item-title">{status.isHome ? 'RIDECORE is the home screen' : 'Make RIDECORE the home screen'}</p>
        <p className="rc-item-sub">
          {status.isHome
            ? 'Home and switching the phone on always open it.'
            : 'Pick RIDECORE as the home app, so Home and switching the phone on open it.'}
        </p>
      </div>
      <button type="button" className={status.isHome ? 'rc-btn rc-btn-small rc-btn-quiet' : 'rc-btn rc-btn-small'} onClick={() => void device.openHomeSettings()}>
        {status.isHome ? 'Change' : 'Choose'}
      </button>
    </div>
  );
}

function MapsOnPhone() {
  const [packs, setPacks] = useState<MapPackMeta[] | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      void mapPackService
        .list()
        .then((list) => live && setPacks(list))
        .catch(() => live && setPacks([]));
    void mapPackService.init().then(load, load);
    const off = mapPackService.subscribe(load);
    return () => {
      live = false;
      off();
    };
  }, []);

  if (!packs) return <p className="rc-note">Loading maps…</p>;
  if (packs.length === 0) return <Empty title="No offline maps" text="Maps saved for trips or areas let you ride without signal." />;
  return (
    <ul className="rc-list">
      {packs.map((pack) => (
        <li key={pack.id} className="rc-tile rc-item">
          <div className="rc-item-text">
            <p className="rc-item-title">{pack.name}</p>
            <p className="rc-item-sub">
              {pack.kind === 'route' ? 'Trip map' : 'Area'} · {bytes(pack.bytes)} · {Math.round((pack.saved / Math.max(1, pack.tiles)) * 100)}% saved
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="rc-toggle" onClick={() => onChange(!on)}>
      <span>
        <b>{label}</b>
        <small>{hint}</small>
      </span>
      <i aria-hidden />
    </button>
  );
}

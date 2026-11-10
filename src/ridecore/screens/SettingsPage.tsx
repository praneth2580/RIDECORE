import { useEffect, useState, type ReactNode } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  getSpeedZoom,
  mapPackService,
  mapService,
  rideLogService,
  setSpeedZoom,
  SPEED_ZOOM_MULTIPLIERS,
  type MapPackMeta,
} from '../engine';
import type { DashShows } from '../dash';
import { device, type HomeStatus, type Layout } from '../device';
import {
  BatteryIcon,
  ClockIcon,
  CompassIcon,
  FlagIcon,
  FuelIcon,
  GaugeIcon,
  GearIcon,
  GlowIcon,
  GpsIcon,
  HeadsetIcon,
  HomeIcon,
  MapIcon,
  MusicIcon,
  OfflineIcon,
  RecordIcon,
  ScreenOnIcon,
  SearchIcon,
  SignalIcon,
  SunIcon,
  VoiceIcon,
  ZoomIcon,
} from '../components/Icons';
import { usePhoneMedia } from '../media';
import { ModuleSettings } from '../components/ModuleSettings';
import { Key } from '../components/Key';
import { bytes } from '../format';
import { LayoutPicture } from './ChooseLayout';

interface SettingsPageProps {
  layout: Layout;
  onLayout: (layout: Layout) => void;
  keepOn: boolean;
  onKeepOn: (on: boolean) => void;
  /** Also on the trip page while navigating, so it's kept above both. */
  voiceOn: boolean;
  onVoice: (on: boolean) => void;
  /** What the dash shows, just below this page. */
  dash: DashShows;
  onDash: (shows: DashShows) => void;
}

const onOff = (on: boolean) => (on ? 'On' : 'Off');

/**
 * Settings as a device has them: keys to tap, lit when on, in a grid that fills the
 * screen either way up. What the dash shows first, as this sits right above it.
 */
export function SettingsPage({ layout, onLayout, keepOn, onKeepOn, voiceOn, onVoice, dash, onDash }: SettingsPageProps) {
  const [autoRecord, setAutoRecord] = useState(() => rideLogService.getAutoRecord());
  const [pins, setPins] = useState(() => mapService.overlaysOnMap());
  const [speedZoom, setSpeedZoomState] = useState(getSpeedZoom);

  /** A key for one part of the dash. */
  const part = (key: keyof DashShows, label: string, icon: ReactNode) => (
    <Key icon={icon} label={label} state={onOff(dash[key])} on={dash[key]} onClick={() => onDash({ ...dash, [key]: !dash[key] })} />
  );

  // One key for three values: each tap the next, round again after the last.
  const zoomAt = SPEED_ZOOM_MULTIPLIERS.indexOf(speedZoom);
  const nextZoom = () => {
    const next = SPEED_ZOOM_MULTIPLIERS[(zoomAt + 1) % SPEED_ZOOM_MULTIPLIERS.length]!;
    setSpeedZoom(next);
    setSpeedZoomState(next);
  };

  return (
    <>
      <h3 className="rc-section">On the dash</h3>
      <div className="rc-keys">
        {part('speed', 'Speed', <GaugeIcon />)}
        {part('map', 'Map', <MapIcon />)}
        {part('trip', 'Trip', <FlagIcon />)}
        {part('whereTo', 'Where to', <SearchIcon />)}
        {part('music', 'Music', <MusicIcon />)}
        {part('weather', 'Weather', <SunIcon />)}
        <Key
          icon={<ZoomIcon />}
          label="Speed zoom"
          state={`×${speedZoom}`}
          steps={{ count: SPEED_ZOOM_MULTIPLIERS.length, at: zoomAt }}
          onClick={nextZoom}
        />
      </div>

      {/* The top line's, then the phone's state: in the dash's corners, else the top line. */}
      <h3 className="rc-section">Status</h3>
      <div className="rc-keys">
        {part('clock', 'Clock', <ClockIcon />)}
        {part('heading', 'Heading', <CompassIcon />)}
        {part('topWeather', 'Weather', <SunIcon />)}
        {part('network', 'Network', <SignalIcon level={3} />)}
        {part('gps', 'GPS', <GpsIcon />)}
        {part('headset', 'Headset', <HeadsetIcon />)}
        {part('battery', 'Battery', <BatteryIcon />)}
      </div>

      <h3 className="rc-section">Riding</h3>
      <div className="rc-keys">
        <Key icon={<VoiceIcon />} label="Voice" state={onOff(voiceOn)} on={voiceOn} onClick={() => onVoice(!voiceOn)} />
        {part('turnGlow', 'Turn glow', <GlowIcon />)}
        <Key
          icon={<FuelIcon />}
          label="Fuel & food"
          state={onOff(pins)}
          on={pins}
          onClick={() => {
            mapService.setOverlaysShown(!pins);
            setPins(!pins);
          }}
        />
        <Key
          icon={<RecordIcon />}
          label="Auto-record"
          state={autoRecord ? 'Every trip' : 'Off'}
          on={autoRecord}
          onClick={() => {
            rideLogService.setAutoRecord(!autoRecord);
            setAutoRecord(!autoRecord);
          }}
        />
        <Key icon={<ScreenOnIcon />} label="Screen on" state={keepOn ? 'Always' : 'Navigating'} on={keepOn} onClick={() => onKeepOn(!keepOn)} />
      </div>

      <h3 className="rc-section">Mounted</h3>
      <div className="rc-layout-choice" role="radiogroup" aria-label="Screen layout">
        {(['landscape', 'portrait'] as const).map((option) => (
          <button key={option} type="button" role="radio" aria-checked={layout === option} onClick={() => onLayout(option)}>
            <LayoutPicture layout={option} />
            <b>{option === 'landscape' ? 'Landscape' : 'Portrait'}</b>
          </button>
        ))}
      </div>

      <h3 className="rc-section">Handlebar module</h3>
      <ModuleSettings />

      <h3 className="rc-section">Phone</h3>
      <PhoneKeys />
    </>
  );
}

/**
 * The phone around RIDECORE: whether it's the home screen, the maps kept for riding
 * without signal, and the way out to Android's own settings.
 */
function PhoneKeys() {
  const [home, setHome] = useState<HomeStatus | null>(null);
  const [packs, setPacks] = useState<MapPackMeta[] | null>(null);
  const [showPacks, setShowPacks] = useState(false);
  const media = usePhoneMedia();

  // Checked again on coming back from Android's settings.
  useEffect(() => {
    const check = () =>
      void device
        .getHomeStatus()
        .then(setHome)
        .catch(() => setHome({ supported: false, isHome: false }));
    check();
    const listener = CapacitorApp.addListener('resume', check);
    return () => void listener.then((l) => l.remove());
  }, []);

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

  const homeState = !home ? '…' : !home.supported ? 'Phone only' : home.isHome ? 'RIDECORE' : 'Tap to set';
  const packState = !packs ? '…' : packs.length === 0 ? 'None' : `${packs.length} · ${bytes(packs.reduce((sum, pack) => sum + pack.bytes, 0))}`;

  return (
    <>
      <div className="rc-keys">
        <Key
          icon={<HomeIcon />}
          label="Home app"
          state={homeState}
          on={home?.isHome ?? false}
          onClick={() => {
            if (home?.supported) void device.openHomeSettings();
          }}
        />
        <Key
          icon={<MusicIcon />}
          label="Music info"
          state={!media.supported ? 'Phone only' : media.access ? 'Allowed' : 'Tap to allow'}
          on={media.access}
          onClick={() => {
            if (media.supported) void device.openMediaAccess();
          }}
        />
        <Key icon={<OfflineIcon />} label="Offline maps" state={packState} onClick={() => setShowPacks((shown) => !shown)} />
        <Key icon={<GearIcon />} label="Phone settings" state="Wi-Fi, Bluetooth…" onClick={() => void device.openSettings()} />
      </div>
      {showPacks ? (
        packs && packs.length > 0 ? (
          <ul className="rc-packs">
            {packs.map((pack) => (
              <li key={pack.id}>
                <b>{pack.name}</b>
                <small>
                  {pack.kind === 'route' ? 'Trip' : 'Area'} · {bytes(pack.bytes)} · {Math.round((pack.saved / Math.max(1, pack.tiles)) * 100)}%
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rc-note">Maps saved for trips or areas let you ride without signal.</p>
        )
      ) : null}
    </>
  );
}

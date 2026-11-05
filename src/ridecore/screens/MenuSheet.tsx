import { useEffect, useState } from 'react';
import { formatDuration, formatKm, formatSavedAt, rideLogService, type RideRecord } from '../engine';
import type { Layout } from '../device';
import { Empty } from '../components/Empty';
import { RidesIcon, SettingsIcon } from '../components/Icons';
import { Sheet } from '../components/Sheet';
import { TrackThumb } from '../components/TrackThumb';
import { SettingsPage } from './SettingsPage';

type Page = 'menu' | 'rides' | 'settings';

interface MenuSheetProps {
  layout: Layout;
  onLayout: (layout: Layout) => void;
  keepOn: boolean;
  onKeepOn: (on: boolean) => void;
  onShowRide: (ride: RideRecord) => void;
  onClose: () => void;
}

/** What the main screen leaves out: past rides and settings, two taps away. */
export function MenuSheet({ onClose, onShowRide, ...settings }: MenuSheetProps) {
  const [page, setPage] = useState<Page>('menu');
  const back = () => setPage('menu');

  if (page === 'rides') {
    return (
      <Sheet title="Rides" onClose={onClose} onBack={back} full>
        <RideHistory onShowRide={onShowRide} />
      </Sheet>
    );
  }
  if (page === 'settings') {
    return (
      <Sheet title="Settings" onClose={onClose} onBack={back} full>
        <SettingsPage {...settings} />
      </Sheet>
    );
  }
  return (
    <Sheet title="Menu" onClose={onClose}>
      <ul className="rc-rows">
        <li>
          <button type="button" className="rc-row" onClick={() => setPage('rides')}>
            <span className="rc-row-icon"><RidesIcon /></span>
            <span className="rc-row-text">
              <b>Rides</b>
              <small>Every ride recorded, on the map</small>
            </span>
            <em aria-hidden>›</em>
          </button>
        </li>
        <li>
          <button type="button" className="rc-row" onClick={() => setPage('settings')}>
            <span className="rc-row-icon"><SettingsIcon /></span>
            <span className="rc-row-text">
              <b>Settings</b>
              <small>Screen, home screen, voice, maps</small>
            </span>
            <em aria-hidden>›</em>
          </button>
        </li>
      </ul>
    </Sheet>
  );
}

function RideHistory({ onShowRide }: { onShowRide: (ride: RideRecord) => void }) {
  const [rides, setRides] = useState<RideRecord[] | null>(null);

  useEffect(() => {
    let live = true;
    rideLogService
      .list()
      .then((list) => live && setRides(list))
      .catch(() => live && setRides([]));
    return () => {
      live = false;
    };
  }, []);

  if (!rides) return <p className="rc-note">Loading rides…</p>;
  if (rides.length === 0) return <Empty title="No rides yet" text="Tap the red button on the main screen to record one." />;
  return (
    <ul className="rc-rows">
      {rides.map((ride) => (
        <li key={ride.id}>
          <button type="button" className="rc-row" onClick={() => onShowRide(ride)}>
            <TrackThumb line={ride.preview} />
            <span className="rc-row-text">
              <b>{ride.name}</b>
              <small>
                {formatKm(ride.distanceMeters)} · {formatDuration(ride.movingSeconds)} · top {Math.round(ride.maxSpeedMps * 3.6)} km/h
              </small>
              <small>{formatSavedAt(ride.startedAt)}</small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

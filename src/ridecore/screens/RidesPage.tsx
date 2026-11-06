import { useEffect, useState } from 'react';
import { formatDuration, formatKm, formatSavedAt, rideLogService, type RideRecord } from '../engine';
import { Empty } from '../components/Empty';
import { RecordIcon } from '../components/Icons';
import { Page } from '../components/Page';
import { TrackThumb } from '../components/TrackThumb';

interface RidesPageProps {
  /** In view: read again, so a ride just saved is there. */
  active: boolean;
  onShowRide: (ride: RideRecord) => void;
}

/** Every ride recorded, newest first, as cards with the ride's shape. Tap one to see it on the map. */
export function RidesPage({ active, onShowRide }: RidesPageProps) {
  const [rides, setRides] = useState<RideRecord[] | null>(null);

  useEffect(() => {
    if (!active) return;
    let live = true;
    rideLogService
      .list()
      .then((list) => live && setRides(list))
      .catch(() => live && setRides([]));
    return () => {
      live = false;
    };
  }, [active]);

  return (
    <Page title="Rides" sub={rides && rides.length > 0 ? `${rides.length} recorded` : undefined}>
      {!rides ? <p className="rc-note">Loading rides…</p> : null}
      {rides && rides.length === 0 ? <Empty icon={<RecordIcon />} title="No rides yet" text="Swipe back to the ride recorder and tap it to record one." /> : null}
      {rides && rides.length > 0 ? (
        <ul className="rc-cards">
          {rides.map((ride) => (
            <li key={ride.id}>
              <button type="button" className="rc-card" onClick={() => onShowRide(ride)}>
                <TrackThumb line={ride.preview} />
                <strong>{formatKm(ride.distanceMeters)}</strong>
                <small>
                  {formatDuration(ride.movingSeconds)} · {formatSavedAt(ride.startedAt)}
                </small>
                <small>top {Math.round(ride.maxSpeedMps * 3.6)} km/h</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Page>
  );
}

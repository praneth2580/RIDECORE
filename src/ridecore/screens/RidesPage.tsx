import { useEffect, useState } from 'react';
import { formatDuration, formatKm, formatSavedAt, rideLogService, type RideRecord } from '../engine';
import { Page } from '../components/Page';
import type { RideCoreState } from '../app/useRideCore';
import { Recorder, type RecorderProps } from '../components/Recorder';
import { TrackThumb } from '../components/TrackThumb';

interface RidesPageProps extends RecorderProps {
  /** In view: read again, so a ride just saved is there. */
  active: boolean;
  onShowRide: (ride: RideRecord) => void;
}

/** What the recorder is doing, in a few words: the line under the screen's name. */
function recorderState({ ride }: RideCoreState): { text: string; live: boolean } {
  if (ride?.state === 'recording') return { text: ride.auto ? 'Recording with navigation' : 'Recording', live: true };
  if (ride?.state === 'paused') return { text: 'Paused', live: false };
  return { text: 'Not recording', live: false };
}

/**
 * Rides, the screen beyond Where to: the recorder's face to start, pause and save a ride,
 * and every ride recorded under it, newest first, as cards with its shape. Tap one to see
 * it on the map. Side by side in landscape.
 */
export function RidesPage({ active, onShowRide, core, onRun }: RidesPageProps) {
  const [rides, setRides] = useState<RideRecord[] | null>(null);
  // A ride just saved: the list reads again.
  const recording = core.ride?.id ?? null;
  const state = recorderState(core);

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
  }, [active, recording]);

  return (
    <Page title="Rides" sub={state.text} subTone={state.live ? 'live' : undefined} fill>
      <div className="rc-rides">
        <Recorder core={core} onRun={onRun} />
        <section className="rc-rides-past" aria-label="Past rides">
          <h3 className="rc-section">{rides && rides.length > 0 ? `Past rides · ${rides.length}` : 'Past rides'}</h3>
          {!rides ? (
            <p className="rc-note">Loading rides…</p>
          ) : rides.length === 0 ? (
            <p className="rc-note">None yet. Tap the face to record your first.</p>
          ) : (
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
          )}
        </section>
      </div>
    </Page>
  );
}

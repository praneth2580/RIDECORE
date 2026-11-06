import { useEffect, useState } from 'react';
import { formatDuration, formatKm, formatSavedAt, rideLogService, type RideRecord } from '../engine';
import { Page } from '../components/Page';
import { Recorder, type RecorderProps } from '../components/Recorder';
import { TrackThumb } from '../components/TrackThumb';
import { recorderLine, rideTotals, topKmh } from '../recording';

interface RidesPageProps extends RecorderProps {
  /** In view: read again, so a ride just saved is there. */
  active: boolean;
  onShowRide: (ride: RideRecord) => void;
}

/**
 * Rides, the screen beyond Where to: the recorder's face to start, pause and save a ride,
 * and every ride recorded under it, newest first, as cards with its shape and name, all
 * of them added up in the heading. Tap one to see it on the map. Side by side in landscape.
 */
export function RidesPage({ active, onShowRide, core, onRun }: RidesPageProps) {
  const [rides, setRides] = useState<RideRecord[] | null>(null);
  // A ride just saved: the list reads again.
  const recording = core.ride?.id ?? null;
  const state = recorderLine(core.ride, rideLogService.getAutoRecord());
  const totals = rides ? rideTotals(rides) : null;

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
          <h3 className="rc-section">
            Past rides
            {totals && totals.count > 0 ? (
              <span>
                {totals.count} · {formatKm(totals.meters)}
              </span>
            ) : null}
          </h3>
          {!rides ? (
            <p className="rc-note">Loading rides…</p>
          ) : rides.length === 0 ? (
            <p className="rc-note">None yet. Tap the face to record your first.</p>
          ) : (
            <ul className="rc-cards">
              {rides.map((ride) => {
                const top = topKmh(ride);
                return (
                  <li key={ride.id}>
                    <button type="button" className="rc-card" onClick={() => onShowRide(ride)}>
                      <TrackThumb line={ride.preview} />
                      <b>{ride.name}</b>
                      <strong>{formatKm(ride.distanceMeters)}</strong>
                      <small>
                        {formatDuration(ride.movingSeconds)}
                        {top === null ? null : ` · top ${top} km/h`}
                      </small>
                      <small>{formatSavedAt(ride.startedAt)}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}

import { formatArrivalTime, formatDuration, formatKm, navigationService, rideLogService } from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import { clock, day, timer } from '../format';

interface Readout {
  label: string;
  value: string;
  detail?: string;
  /** 0–1 along the trip, or null for no scale. */
  progress: number | null;
}

/** The most useful thing right now: the trip, the route on offer, the ride, or the time. */
function readout({ nav, trip, ride, now }: RideCoreState): Readout {
  if (nav.status === 'navigating' || nav.status === 'rerouting' || nav.status === 'paused') {
    const seconds = nav.remainingDurationSeconds ?? 0;
    const remaining = nav.remainingDistanceMeters ?? 0;
    const total = navigationService.getActiveCalculatedRoute()?.distanceMeters ?? remaining;
    return {
      label: `Arrive ${formatArrivalTime(now + seconds * 1000)}`,
      value: formatDuration(seconds),
      detail: formatKm(remaining),
      progress: total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0,
    };
  }
  const offered = nav.status === 'choosing' ? nav.alternatives?.[nav.selectedAlternativeIndex ?? 0] : undefined;
  if (offered) {
    return {
      label: trip.destination?.name ?? 'Route',
      value: formatDuration(offered.durationSeconds),
      detail: formatKm(offered.distanceMeters),
      progress: null,
    };
  }
  if (ride) {
    return {
      label: ride.state === 'paused' ? 'Ride paused' : 'Riding',
      value: formatKm(ride.distanceMeters),
      detail: timer(rideLogService.activeSeconds()),
      progress: null,
    };
  }
  return { label: day(now), value: clock(now), progress: null };
}

/** A dial on the right in landscape, a line under the road in portrait (ridecore.css). */
export function TripReadout({ core }: { core: RideCoreState }) {
  const { label, value, detail, progress } = readout(core);
  return (
    <div className="rc-trip">
      <span className="rc-trip-label">{label}</span>
      <span className="rc-trip-value">{value}</span>
      {detail ? <span className="rc-trip-detail">{detail}</span> : null}
      {progress != null ? (
        <span className="rc-trip-scale" style={{ ['--p' as string]: progress }} aria-label={`${Math.round(progress * 100)}% of the way`}>
          <i />
        </span>
      ) : null}
    </div>
  );
}

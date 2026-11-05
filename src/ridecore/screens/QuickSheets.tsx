import { formatKm, rideLogService, type LiveRide } from '../engine';
import { Sheet } from '../components/Sheet';
import { timer } from '../format';

interface RideSheetProps {
  ride: LiveRide;
  onRun: (work: () => Promise<unknown>) => void;
  onClose: () => void;
}

/** The ride being recorded: how far, how long, and pause or finish. */
export function RideSheet({ ride, onRun, onClose }: RideSheetProps) {
  const paused = ride.state === 'paused';
  return (
    <Sheet title={paused ? 'Ride paused' : 'Recording'} onClose={onClose}>
      <div className="rc-ride-stats">
        <span>
          <b>{formatKm(ride.distanceMeters)}</b>
          <small>distance</small>
        </span>
        <span>
          <b>{timer(rideLogService.activeSeconds())}</b>
          <small>time</small>
        </span>
      </div>
      <div className="rc-sheet-actions">
        <button type="button" className="rc-ctl rc-ctl-wide" onClick={() => onRun(() => (paused ? rideLogService.resume() : rideLogService.pause()))}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className="rc-ctl rc-ctl-wide rc-ctl-go" onClick={() => onRun(() => rideLogService.finish())}>
          Finish and save
        </button>
      </div>
    </Sheet>
  );
}

/** Ending a route is one tap away, so it asks first. */
export function EndSheet({ onEnd, onClose }: { onEnd: () => void; onClose: () => void }) {
  return (
    <Sheet title="End navigation?" onClose={onClose}>
      <div className="rc-sheet-actions">
        <button type="button" className="rc-ctl rc-ctl-wide" onClick={onClose}>Keep going</button>
        <button type="button" className="rc-ctl rc-ctl-wide rc-ctl-end" onClick={onEnd}>End</button>
      </div>
    </Sheet>
  );
}

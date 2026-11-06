import { formatKm, rideLogService } from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import { timer } from '../format';
import { CheckIcon } from './Icons';

export interface RecorderProps {
  core: RideCoreState;
  /** Runs a recorder action, telling the rider if it fails. */
  onRun: (work: () => Promise<unknown>) => void;
}

/** The ride recorder: one big face to tap, to record, pause and carry on. Save keeps the ride. */
export function Recorder({ core, onRun }: RecorderProps) {
  const { ride } = core;
  const state = ride?.state ?? 'off';

  const tap = () =>
    onRun(() => (state === 'recording' ? rideLogService.pause() : state === 'paused' ? rideLogService.resume() : rideLogService.start()));

  return (
    <div className="rc-rec">
      <button
        type="button"
        className="rc-rec-face"
        data-state={state}
        aria-label={state === 'recording' ? 'Pause the ride' : state === 'paused' ? 'Carry on recording' : 'Record the ride'}
        onClick={tap}
      >
        {ride ? (
          <>
            <span className="rc-rec-value">{formatKm(ride.distanceMeters)}</span>
            <span className="rc-rec-time">{timer(rideLogService.activeSeconds())}</span>
          </>
        ) : (
          <i className="rc-rec-dot" aria-hidden />
        )}
        <span className="rc-rec-hint">{state === 'recording' ? 'Tap to pause' : state === 'paused' ? 'Tap to carry on' : 'Tap to record'}</span>
      </button>
      {ride ? (
        <div className="rc-actions">
          <button type="button" className="rc-action" data-tone="go" onClick={() => onRun(() => rideLogService.finish())}>
            <span>
              <CheckIcon />
            </span>
            <b>Save ride</b>
          </button>
        </div>
      ) : null}
    </div>
  );
}

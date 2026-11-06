import { formatKm, rideLogService } from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import { CheckIcon } from '../components/Icons';
import { Page } from '../components/Page';
import { timer } from '../format';

interface RecordPageProps {
  core: RideCoreState;
  /** Runs a recorder action, telling the rider if it fails. */
  onRun: (work: () => Promise<unknown>) => void;
}

/** The ride recorder: one big face to tap, to record, pause and carry on. Save keeps the ride. */
export function RecordPage({ core, onRun }: RecordPageProps) {
  const { ride } = core;
  const state = ride?.state ?? 'off';
  const sub =
    state === 'recording'
      ? ride?.auto
        ? 'Recording with navigation'
        : 'Recording'
      : state === 'paused'
        ? 'Paused'
        : 'Not recording';

  const tap = () =>
    onRun(() => (state === 'recording' ? rideLogService.pause() : state === 'paused' ? rideLogService.resume() : rideLogService.start()));

  return (
    <Page title="Ride recorder" sub={sub} subTone={state === 'recording' ? 'live' : undefined}>
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
    </Page>
  );
}

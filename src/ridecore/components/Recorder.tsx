import { useEffect, useState } from 'react';
import { formatKm, rideLogService } from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import { timer } from '../format';
import { averageKmh, recorderNote } from '../recording';
import { CheckIcon, DiscardIcon, PauseIcon, PlayIcon } from './Icons';

export interface RecorderProps {
  core: RideCoreState;
  /** Runs a recorder action, telling the rider if it fails. */
  onRun: (work: () => Promise<unknown>) => void;
}

/** How long Discard waits for its second tap. */
const CONFIRM_MS = 3000;

/**
 * The ride recorder: one big face to tap, to record, pause and carry on. While it records
 * the face is the only control, so a gloved tap can't end a ride by mistake; paused, Save
 * keeps the ride and Discard (tapped twice) throws it away.
 */
export function Recorder({ core, onRun }: RecorderProps) {
  const { ride } = core;
  const state = ride?.state ?? 'off';
  const [discarding, setDiscarding] = useState(false);

  // A second tap within a few seconds, and only while still paused.
  useEffect(() => {
    if (!discarding) return;
    const id = window.setTimeout(() => setDiscarding(false), CONFIRM_MS);
    return () => window.clearTimeout(id);
  }, [discarding]);
  const confirming = discarding && state === 'paused';

  const tap = () => {
    setDiscarding(false);
    onRun(() => (state === 'recording' ? rideLogService.pause() : state === 'paused' ? rideLogService.resume() : rideLogService.start()));
  };

  const discard = () => {
    if (!confirming) return setDiscarding(true);
    setDiscarding(false);
    onRun(() => rideLogService.discard());
  };

  const seconds = ride ? rideLogService.activeSeconds() : 0;
  const average = ride ? averageKmh(ride.distanceMeters, seconds) : null;
  const note = recorderNote(ride);

  return (
    <div className="rc-rec" data-state={state}>
      <button
        type="button"
        className="rc-rec-face"
        data-state={state}
        aria-label={state === 'recording' ? 'Pause the ride' : state === 'paused' ? 'Carry on recording' : 'Record a ride'}
        onClick={tap}
      >
        {ride ? (
          <>
            <span className="rc-rec-state">{state === 'recording' ? 'Rec' : 'Paused'}</span>
            <span className="rc-rec-value">{formatKm(ride.distanceMeters)}</span>
            <span className="rc-rec-time">{timer(seconds)}</span>
            <span className="rc-rec-avg">{average === null ? 'avg –' : `avg ${average} km/h`}</span>
            <span className="rc-rec-glyph">{state === 'recording' ? <PauseIcon /> : <PlayIcon />}</span>
          </>
        ) : (
          <>
            <i className="rc-rec-dot" aria-hidden />
            <span className="rc-rec-hint">Tap to record</span>
          </>
        )}
      </button>
      {note ? <p className="rc-rec-note">{note}</p> : null}
      {state === 'paused' ? (
        <div className="rc-actions">
          <button type="button" className="rc-action" data-tone="go" onClick={() => onRun(() => rideLogService.finish())}>
            <span>
              <CheckIcon />
            </span>
            <b>Save ride</b>
          </button>
          <button type="button" className="rc-action" data-tone="end" data-confirm={confirming ? 'true' : undefined} onClick={discard}>
            <span>
              <DiscardIcon />
            </span>
            <b>{confirming ? 'Tap again' : 'Discard'}</b>
          </button>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { formatArrivalTime, formatDuration, formatKm, formatManeuverDistance, maneuverKind, navigationService } from '../engine';
import type { RideCoreState } from '../app/useRideCore';
import { CheckIcon, EndIcon, VoiceIcon, VoiceOffIcon } from '../components/Icons';
import { ManeuverGlyph } from '../components/ManeuverGlyph';
import { Page } from '../components/Page';
import { upcomingTurns } from '../turns';

interface TripPageProps {
  core: RideCoreState;
  /** Where the trip goes. */
  title: string;
  voiceOn: boolean;
  onVoice: (on: boolean) => void;
  onEnd: () => void;
}

/** A second tap ends the trip within this long; after it, End asks again. */
const CONFIRM_MS = 3000;
/** Turns listed: enough to see what's coming. */
const TURNS_SHOWN = 8;

/**
 * The trip under way, a swipe from the dash: the numbers big, as on the dash; two round
 * keys (voice, end); the turns ahead. Side by side in landscape.
 */
export function TripPage({ core, title, voiceOn, onVoice, onEnd }: TripPageProps) {
  const { nav, now } = core;
  const arrived = nav.status === 'arrived';
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const id = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => window.clearTimeout(id);
  }, [confirming]);

  const seconds = nav.remainingDurationSeconds ?? 0;
  const route = navigationService.getActiveCalculatedRoute();
  const turns = arrived ? [] : upcomingTurns(route?.instructions ?? [], nav.currentInstruction, nav.distanceToNextManeuverMeters, TURNS_SHOWN);

  // Ending mid-ride takes two taps, without a dialog in the way.
  const end = () => {
    if (arrived || confirming) onEnd();
    else setConfirming(true);
  };

  return (
    <Page title="Trip" sub={title} fill>
      <div className="rc-tripview">
        <div className="rc-tripview-main">
          {arrived ? (
            <p className="rc-tripview-arrived">Arrived</p>
          ) : (
            <dl className="rc-readouts">
              <div>
                <dt>to go</dt>
                <dd>{formatDuration(seconds)}</dd>
              </div>
              <div>
                <dt>left</dt>
                <dd>{formatKm(nav.remainingDistanceMeters ?? 0)}</dd>
              </div>
              <div>
                <dt>arrive</dt>
                <dd>{formatArrivalTime(now + seconds * 1000)}</dd>
              </div>
            </dl>
          )}

          <div className="rc-actions">
            {arrived ? null : (
              <button
                type="button"
                className="rc-action"
                role="switch"
                aria-checked={voiceOn}
                data-on={voiceOn ? 'true' : undefined}
                onClick={() => onVoice(!voiceOn)}
              >
                <span>{voiceOn ? <VoiceIcon /> : <VoiceOffIcon />}</span>
                <b>{voiceOn ? 'Voice on' : 'Voice off'}</b>
              </button>
            )}
            <button
              type="button"
              className="rc-action"
              data-tone={arrived ? 'go' : 'end'}
              data-confirm={confirming ? 'true' : undefined}
              onClick={end}
            >
              <span>{arrived ? <CheckIcon /> : <EndIcon />}</span>
              <b>{arrived ? 'Finish' : confirming ? 'Tap again' : 'End trip'}</b>
            </button>
          </div>
        </div>

        {turns.length > 0 ? (
          <ol className="rc-turns" aria-label="Turns ahead">
            {turns.map(({ instruction, distanceMeters }, index) => (
              <li key={index} className="rc-turn">
                <ManeuverGlyph kind={maneuverKind(instruction)} />
                <span className="rc-row-text">
                  <b>{formatManeuverDistance(distanceMeters)}</b>
                  <small>{instruction.text}</small>
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </Page>
  );
}

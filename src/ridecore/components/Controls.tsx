import type { RideCoreState } from '../app/useRideCore';
import { MenuIcon, RecordIcon, VoiceIcon } from './Icons';

interface ControlsProps {
  core: RideCoreState;
  voiceOn: boolean;
  onToggleVoice: () => void;
  onRecord: () => void;
  onMenu: () => void;
  onStart: () => void;
  onCancel: () => void;
  onEnd: () => void;
  onRetry: () => void;
}

/** The few buttons the moment needs, big enough for gloves. */
export function Controls(props: ControlsProps) {
  const { core, voiceOn } = props;
  const status = core.nav.status;

  if (status === 'choosing') {
    return (
      <nav className="rc-controls" aria-label="Route">
        <button type="button" className="rc-ctl rc-ctl-wide" onClick={props.onCancel}>Cancel</button>
        <button type="button" className="rc-ctl rc-ctl-wide rc-ctl-go" onClick={props.onStart}>Start</button>
      </nav>
    );
  }

  if (status === 'error') {
    return (
      <nav className="rc-controls" aria-label="Route">
        <button type="button" className="rc-ctl rc-ctl-wide" onClick={props.onCancel}>Cancel</button>
        <button type="button" className="rc-ctl rc-ctl-wide rc-ctl-go" onClick={props.onRetry}>Try again</button>
      </nav>
    );
  }

  const underway = status === 'navigating' || status === 'rerouting' || status === 'paused';
  const ride = core.ride;
  return (
    <nav className="rc-controls" aria-label="Controls">
      {underway ? <button type="button" className="rc-ctl rc-ctl-wide rc-ctl-end" onClick={props.onEnd}>End</button> : null}
      {status === 'planning' ? <button type="button" className="rc-ctl rc-ctl-wide" onClick={props.onCancel}>Cancel</button> : null}
      {status === 'arrived' ? <button type="button" className="rc-ctl rc-ctl-wide rc-ctl-go" onClick={props.onCancel}>Done</button> : null}
      {underway ? (
        <button type="button" className="rc-ctl" data-off={voiceOn ? undefined : 'true'} aria-label={voiceOn ? 'Mute voice' : 'Voice on'} onClick={props.onToggleVoice}>
          <VoiceIcon on={voiceOn} />
        </button>
      ) : null}
      <button
        type="button"
        className="rc-ctl rc-ctl-rec"
        data-state={ride?.state}
        aria-label={ride ? 'Ride recording' : 'Record the ride'}
        onClick={props.onRecord}
      >
        <RecordIcon />
      </button>
      <button type="button" className="rc-ctl" aria-label="Menu" onClick={props.onMenu}>
        <MenuIcon />
      </button>
    </nav>
  );
}

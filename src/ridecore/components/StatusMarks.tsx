import type { Battery } from '../app/useBattery';
import type { GpsState } from '../format';
import { headsetName, type NetworkMark } from '../status';
import { AirplaneIcon, BatteryLevelIcon, GpsIcon, HeadsetIcon, NoNetworkIcon, SignalIcon, WifiIcon } from './Icons';

/**
 * The phone's state as small marks: an icon, and a word only where it helps. The same
 * marks sit in the dash's corners and, away from the dash, in the top line (`compact`:
 * the icon alone where it says enough).
 */
interface MarkProps {
  compact?: boolean;
}



export function NetworkMarkView({ mark, compact }: MarkProps & { mark: NetworkMark }) {
  const icon =
    mark.kind === 'signal' ? <SignalIcon level={mark.level} /> : mark.kind === 'wifi' ? <WifiIcon /> : mark.kind === 'airplane' ? <AirplaneIcon /> : <NoNetworkIcon />;
  return (
    <span className="rc-mark" data-mark="network" data-warn={mark.warning ? 'true' : undefined} aria-label={mark.label} role="img">
      {icon}
      {mark.warning && !compact ? <span>{mark.warning}</span> : null}
    </span>
  );
}

export function GpsMark({ state, compact }: MarkProps & { state: GpsState }) {
  return (
    <span className="rc-mark" data-mark="gps" data-state={state} aria-label={`GPS ${state}`} role="img">
      <GpsIcon />
      {compact ? null : <span>{state === 'none' ? 'No GPS' : state === 'lost' ? 'GPS lost' : 'GPS'}</span>}
    </span>
  );
}

/** Low, from here: red unless charging. */
const LOW_BATTERY = 0.15;

export function BatteryMark({ battery }: MarkProps & { battery: Battery }) {
  const percent = Math.round(battery.level * 100);
  return (
    <span
      className="rc-mark"
      data-mark="battery"
      data-warn={!battery.charging && battery.level <= LOW_BATTERY ? 'true' : undefined}
      data-charging={battery.charging ? 'true' : undefined}
      aria-label={`Battery ${percent}%${battery.charging ? ', charging' : ''}`}
      role="img"
    >
      <BatteryLevelIcon level={battery.level} charging={battery.charging} />
      <span>{percent}%</span>
    </span>
  );
}

export function HeadsetMark({ headset, compact }: MarkProps & { headset: Parameters<typeof headsetName>[0] }) {
  const name = headsetName(headset);
  if (!name) return null;
  return (
    <span className="rc-mark" data-mark="headset" aria-label={`Headset: ${name}`} role="img">
      <HeadsetIcon />
      {compact ? null : <span>{name}</span>}
    </span>
  );
}

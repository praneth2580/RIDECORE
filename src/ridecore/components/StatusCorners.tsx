import type { Battery } from '../app/useBattery';
import type { DashShows } from '../dash';
import type { PhoneHeadset } from '../device';
import type { NetworkMark } from '../status';
import type { GpsState } from '../format';
import { BatteryMark, GpsMark, HeadsetMark, NetworkMarkView } from './StatusMarks';

interface StatusCornersProps {
  /**
   * speed: the four corners of the speedometer's square (portrait). cluster: the dash's
   * four corners, above and below the two dials (landscape). Both are drawn; the
   * stylesheet shows the one for the way the phone is turned.
   */
  place: 'speed' | 'cluster';
  network: NetworkMark | null;
  gps: GpsState;
  battery: Battery | null;
  headset: PhoneHeadset | undefined;
  shows: DashShows;
}

/**
 * The phone's state in the room a round dial leaves in a square screen, as a car's
 * cluster has its lights round the gauges: the connection top left, GPS top right, a
 * headset bottom left (only while one is connected), the battery bottom right. A corner
 * stays empty when there's nothing to say.
 */
export function StatusCorners({ place, network, gps, battery, headset, shows }: StatusCornersProps) {
  return (
    <div className="rc-corners" data-place={place}>
      <span data-corner="tl">{shows.network && network ? <NetworkMarkView mark={network} /> : null}</span>
      <span data-corner="tr">{shows.gps ? <GpsMark state={gps} /> : null}</span>
      <span data-corner="bl">{shows.headset ? <HeadsetMark headset={headset} /> : null}</span>
      <span data-corner="br">{shows.battery && battery ? <BatteryMark battery={battery} /> : null}</span>
    </div>
  );
}

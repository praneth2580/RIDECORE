import { useId } from 'react';

/** The arc runs 270°, from bottom left round to bottom right. */
const SWEEP = 270;
const START = 135;
/** A fine tick every 5°, a major one every 45°. */
const TICKS = 55;
const MAJOR_EVERY = 9;

interface SpeedDialProps {
  /** km/h; null shows a dash. */
  speed: number | null;
  /** The speed the arc fills at. */
  max?: number;
  unit?: string;
}

/** The speedometer: a lime arc over fine ticks on a softly shaded face, the speed large in the middle. */
export function SpeedDial({ speed, max = 160, unit = 'km/h' }: SpeedDialProps) {
  // React's ids hold characters a url(#…) reference may not take.
  const id = `rc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const fraction = speed == null ? 0 : Math.min(1, speed / max);
  const end = START + SWEEP * fraction;

  return (
    <div className="rc-dial" role="img" aria-label={speed == null ? 'Speed unknown' : `${Math.round(speed)} ${unit}`}>
      <svg viewBox="-100 -100 200 200" aria-hidden>
        <defs>
          <radialGradient id={`${id}-face`} cx="0" cy="-30" r="130" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#202124" />
            <stop offset="1" stopColor="#111214" />
          </radialGradient>
        </defs>
        <circle className="rc-dial-face" r="96" fill={`url(#${id}-face)`} />
        <circle className="rc-dial-rim" r="95.5" />
        {/* The arc covers the ticks it has reached. */}
        {Array.from({ length: TICKS }, (_, i) => (
          <line
            key={i}
            className={i % MAJOR_EVERY === 0 ? 'rc-dial-tick rc-dial-tick-major' : 'rc-dial-tick'}
            x1={i % MAJOR_EVERY === 0 ? 63 : 67}
            x2="78"
            transform={`rotate(${START + (SWEEP * i) / (TICKS - 1)})`}
          />
        ))}
        <circle className="rc-dial-inner" r="56" />
        {/* pathLength 1: the dash is the share of a full turn the arc covers. */}
        <circle
          className="rc-dial-arc"
          r="72.5"
          pathLength={1}
          strokeDasharray={`${(SWEEP / 360) * fraction} 1`}
          transform={`rotate(${START})`}
        />
        {fraction > 0 ? (
          <rect className="rc-dial-notch" x="63" y="-2" width="19" height="4" rx="1" transform={`rotate(${end})`} />
        ) : null}
      </svg>
      <div className="rc-dial-readout">
        <span className="rc-dial-value">{speed == null ? '–' : Math.round(speed)}</span>
        <span className="rc-dial-unit">{unit}</span>
      </div>
    </div>
  );
}

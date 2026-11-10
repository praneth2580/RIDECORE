import type { StructureSign } from '../engine';

/** Side view: where the two roads sit and part (the same drawing as TrailCompass's banner). */
const SIDE = { high: 8, low: 23, start: 3, split: 11, rampEnd: 21, end: 44 };

/**
 * A flyover or underpass ahead, seen from the side: the road the route takes in lime
 * with an arrowhead, the other faint and dashed. Up onto the flyover or along the road
 * under it; down into the underpass or over it. A bridge stands on pillars.
 */
export function StructureGlyph({ sign }: { sign: StructureSign }) {
  const { high, low, start, split, rampEnd, end } = SIDE;
  const fromGround = sign.action === 'take' || sign.action === 'below' || sign.action === 'avoid';
  // A flyover starts low and climbs; an underpass starts on the surface and dips.
  // Already on one, it's the other way round.
  const startsHigh = (sign.kind === 'tunnel') === fromGround;
  const from = startsHigh ? high : low;
  const to = startsHigh ? low : high;
  const changes = sign.action === 'take' || sign.action === 'exit';
  const level = (x: number) => `M${x} ${from}H${end}`;
  const change = (x: number) => `M${x} ${from}${x < split ? `H${split}` : ''}L${rampEnd} ${to}H${end}`;
  const routeEnd = changes ? to : from;
  // Under the raised road: the ramp's deck from the ground, or the level deck when on it.
  const pillars = sign.kind === 'bridge' ? (fromGround ? [27, 38] : [29, 39]) : [];
  return (
    <svg className="rc-structure" viewBox="0 0 48 30" fill="none" aria-hidden data-kind={sign.kind}>
      {pillars.map((x) => (
        <path key={x} className="rc-structure-pillar" d={`M${x} ${high + 1.5}V${low}`} />
      ))}
      <path className="rc-structure-other" d={changes ? level(split) : change(split)} />
      <path className="rc-structure-route" d={changes ? change(start) : level(start)} />
      <path className="rc-structure-route" d={`M${end - 5} ${routeEnd - 4.5}L${end} ${routeEnd}L${end - 5} ${routeEnd + 4.5}`} />
    </svg>
  );
}

/** A traffic light: the signal coming up. */
export function SignalGlyph() {
  return (
    <svg className="rc-signal" viewBox="0 0 12 24" aria-hidden>
      <rect className="rc-signal-housing" x="1" y="1" width="10" height="22" rx="3" />
      <circle className="rc-signal-red" cx="6" cy="6" r="2.4" />
      <circle className="rc-signal-amber" cx="6" cy="12" r="2.4" />
      <circle className="rc-signal-green" cx="6" cy="18" r="2.4" />
    </svg>
  );
}

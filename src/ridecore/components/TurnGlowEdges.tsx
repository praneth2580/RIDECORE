import type { TurnGlow } from '../glow';

/**
 * The screen's edges lit for the next turn, over whatever screen shows: lime on the side
 * it goes to, brighter as it comes, pulsing at it; green on both for arriving. Both edges
 * are always there, so the glow fades in and out instead of switching.
 */
export function TurnGlowEdges({ glow }: { glow: TurnGlow | null }) {
  const on = (side: 'left' | 'right') => (glow && (glow.side === side || glow.side === 'both') ? glow.strength : 0);
  return (
    <div className="rc-glow" data-urgent={glow?.urgent ? 'true' : undefined} data-tone={glow?.arrive ? 'arrive' : undefined} aria-hidden>
      <i data-edge="left" style={{ opacity: on('left') }} />
      <i data-edge="right" style={{ opacity: on('right') }} />
    </div>
  );
}

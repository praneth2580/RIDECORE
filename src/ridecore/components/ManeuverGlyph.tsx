import type { ManeuverKind } from '../engine';

/** An arrowhead: tip at (x, y), pointing `deg` degrees clockwise from east. */
function head(x: number, y: number, deg: number, length = 11, halfWidth = 8.5): string {
  const a = (deg * Math.PI) / 180;
  const [dx, dy] = [Math.cos(a), Math.sin(a)];
  const [bx, by] = [x - dx * length, y - dy * length];
  const corners = [
    [x, y],
    [bx - dy * halfWidth, by + dx * halfWidth],
    [bx + dy * halfWidth, by - dx * halfWidth],
  ];
  return corners.map(([px, py]) => `${px!.toFixed(1)},${py!.toFixed(1)}`).join(' ');
}

/** Each turn drawn to the right on a 48-unit grid; the line ends where its arrowhead starts. */
const TURNS: Record<string, { line: string; tip: [number, number, number] }> = {
  straight: { line: 'M24 43V16', tip: [24, 5, -90] },
  'slight-right': { line: 'M19 43V30L29.2 19.8', tip: [37, 12, -45] },
  right: { line: 'M16 43V27a9 9 0 0 1 9-9h7', tip: [43, 18, 0] },
  'sharp-right': { line: 'M17 43V19Q17 10 25 13L30.8 19.7', tip: [38, 28, 49] },
  // Left-hand traffic (India): a U-turn goes round to the right.
  uturn: { line: 'M15 43V20a9.5 9.5 0 0 1 19 0v7', tip: [34, 38, 90] },
};

/** The next turn, the way navigation units draw it: a clean white arrow. */
export function ManeuverGlyph({ kind }: { kind: ManeuverKind }) {
  if (kind === 'arrive') {
    return (
      <svg className="rc-glyph" viewBox="0 0 48 48" aria-hidden>
        <path className="rc-glyph-fill" d="M24 45s-13-13.4-13-23.5a13 13 0 0 1 26 0C37 31.6 24 45 24 45Z" />
        <circle className="rc-glyph-hole" cx="24" cy="21.5" r="5" />
      </svg>
    );
  }
  const left = kind.endsWith('left');
  const turn = TURNS[left ? kind.replace('left', 'right') : kind] ?? TURNS.straight!;
  return (
    <svg className="rc-glyph" viewBox="0 0 48 48" aria-hidden>
      <g transform={left ? 'translate(48 0) scale(-1 1)' : undefined}>
        <path className="rc-glyph-line" d={turn.line} />
        <polygon className="rc-glyph-fill" points={head(...turn.tip)} />
      </g>
    </svg>
  );
}

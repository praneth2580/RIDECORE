import type { Coordinate } from '../engine';

const SIZE = 64;
const PAD = 8;
const MAX_POINTS = 120;

/** A trip's or ride's line, fitted to a small square. */
export function TrackThumb({ line }: { line: Coordinate[] }) {
  const step = Math.max(1, Math.ceil(line.length / MAX_POINTS));
  const points = line.filter((_, i) => i % step === 0 || i === line.length - 1);
  if (points.length < 2) return <span className="rc-thumb" aria-hidden />;

  // Longitude shrinks towards the poles: scale it by the latitude so shapes keep their proportions.
  const midLat = points.reduce((sum, [, lat]) => sum + lat, 0) / points.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = points.map(([lon]) => lon * kx);
  const ys = points.map(([, lat]) => lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = (SIZE - PAD * 2) / span;
  const offX = (SIZE - (maxX - minX) * scale) / 2;
  const offY = (SIZE - (maxY - minY) * scale) / 2;
  const at = (i: number) => `${(offX + (xs[i]! - minX) * scale).toFixed(1)},${(SIZE - offY - (ys[i]! - minY) * scale).toFixed(1)}`;
  const path = points.map((_, i) => at(i)).join(' ');
  const [startX, startY] = at(0).split(',');
  const [endX, endY] = at(points.length - 1).split(',');

  return (
    <svg className="rc-thumb" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
      <polyline points={path} fill="none" />
      <circle className="rc-thumb-start" cx={startX} cy={startY} r="3" />
      <circle className="rc-thumb-end" cx={endX} cy={endY} r="3.5" />
    </svg>
  );
}

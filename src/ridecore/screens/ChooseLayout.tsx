import type { Layout } from '../device';

interface ChooseLayoutProps {
  onChoose: (layout: Layout) => void;
}

/** First start: which way the phone is mounted. RIDECORE holds the screen that way from then on. */
export function ChooseLayout({ onChoose }: ChooseLayoutProps) {
  return (
    <section className="rc-choose" aria-labelledby="rc-choose-title">
      <p className="rc-head-brand">RIDECORE</p>
      <h1 id="rc-choose-title">How is the phone mounted?</h1>
      <p className="rc-choose-copy">RIDECORE keeps the screen this way. You can change it later in Settings.</p>
      <div className="rc-choose-options">
        <button type="button" onClick={() => onChoose('landscape')}>
          <LayoutPicture layout="landscape" />
          <b>Landscape</b>
          <small>Wide: speed, turn and trip side by side</small>
        </button>
        <button type="button" onClick={() => onChoose('portrait')}>
          <LayoutPicture layout="portrait" />
          <b>Portrait</b>
          <small>Tall: speed on top, the turn below</small>
        </button>
      </div>
    </section>
  );
}

/** A phone turned that way, with the speed dial and the map on it. */
export function LayoutPicture({ layout }: { layout: Layout }) {
  const wide = layout === 'landscape';
  const phone = wide ? { x: 5, y: 31, w: 120, h: 68 } : { x: 31, y: 5, w: 68, h: 120 };
  const dial = wide ? { cx: 34, cy: 65 } : { cx: 65, cy: 33 };
  const map = wide ? { x: 59, y: 38, w: 59, h: 54 } : { x: 38, y: 58, w: 54, h: 60 };
  const route = `${map.x + map.w * 0.3},${map.y + map.h - 8} ${map.x + map.w * 0.3},${map.y + map.h * 0.45} ${map.x + map.w * 0.7},${map.y + map.h * 0.45} ${map.x + map.w * 0.7},${map.y + 9}`;
  return (
    <svg className="rc-layout-pic" viewBox="0 0 130 130" aria-hidden>
      <rect className="rc-layout-phone" x={phone.x} y={phone.y} width={phone.w} height={phone.h} rx="11" />
      <circle className="rc-layout-dial" cx={dial.cx} cy={dial.cy} r="17" />
      <circle
        className="rc-layout-arc"
        cx={dial.cx}
        cy={dial.cy}
        r="17"
        pathLength={1}
        strokeDasharray="0.45 1"
        transform={`rotate(135 ${dial.cx} ${dial.cy})`}
      />
      <rect className="rc-layout-map" x={map.x} y={map.y} width={map.w} height={map.h} rx="7" />
      <polyline className="rc-layout-route" points={route} />
    </svg>
  );
}

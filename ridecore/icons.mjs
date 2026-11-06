/**
 * RIDECORE's mark everywhere it shows: the Android launcher icons (square, round and
 * adaptive), the splash, the app's web icons and the website's. One source, the
 * website's mark: a gauge, lime most of the way round, its needle on the lime's end.
 *
 *   node ridecore/icons.mjs
 *
 * TrailCompass's scripts/generate-icons.mjs draws TrailCompass's compass into the same
 * files: don't run it. .gitattributes keeps these files RIDECORE's on a merge.
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android/app/src/main/res');

const BLACK = '#000';
const TRACK = '#2b2c30';
const LIME = '#dffe45';
const NEEDLE = '#fff';

/** The mark on a 64 × 64 grid: the gauge's centre is (32, 33), its radius 20. */
const MARK = `<path d="M17.86 47.14A20 20 0 1 1 46.14 47.14" stroke="${TRACK}" stroke-width="6" stroke-linecap="round"/>
  <path d="M17.86 47.14A20 20 0 1 1 49.32 23" stroke="${LIME}" stroke-width="6" stroke-linecap="round"/>
  <path d="M32 33l8.7-5" stroke="${NEEDLE}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="32" cy="33" r="4" fill="${NEEDLE}"/>`;

/** The middle of what the mark draws (not the gauge's centre: there's no arc below it). */
const MIDDLE = { x: 32, y: 30.07 };
/** From that middle to the farthest ink: the round ends of the arc, bottom left and right. */
const REACH = 25.2;

const n = (v) => Number(v.toFixed(3));

/**
 * An SVG of the mark. `bg` is the tile behind it: a rounded square (the website's mark),
 * a square, a circle, or nothing. `reach` is how far from the middle the ink may go, as a
 * share of the size; left out, the mark sits exactly as on the 64 grid.
 */
function svg({ width, height = width, bg = 'rounded', reach }) {
  const min = Math.min(width, height);
  const k = reach ? (reach * min) / REACH : width / 64;
  const at = reach ? { x: width / 2, y: height / 2 } : { x: MIDDLE.x * k, y: MIDDLE.y * k };
  const tile = {
    rounded: `<rect width="${width}" height="${height}" rx="${n((15 / 64) * min)}" fill="${BLACK}"/>`,
    square: `<rect width="${width}" height="${height}" fill="${BLACK}"/>`,
    circle: `<circle cx="${n(width / 2)}" cy="${n(height / 2)}" r="${n(min / 2)}" fill="${BLACK}"/>`,
    none: '',
  }[bg];
  const move = `translate(${n(at.x - MIDDLE.x * k)} ${n(at.y - MIDDLE.y * k)}) scale(${n(k)})`;
  // On the 64 grid at 64 px, the mark as it is: no transform.
  const ink = move === 'translate(0 0) scale(1)' ? `  ${MARK}` : `  <g transform="${move}">\n  ${MARK}\n  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  ${tile}
${ink}
</svg>
`;
}

async function png(path, options) {
  await mkdir(dirname(path), { recursive: true });
  await sharp(Buffer.from(svg(options))).png().toFile(path);
}

async function text(path, body) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

// The 64-grid mark itself, exactly: the website's and the app's favicon.
const mark64 = svg({ width: 64 });
await text(join(root, 'site/mark.svg'), mark64);
await text(join(root, 'public/favicon.svg'), mark64);
await png(join(root, 'site/mark-32.png'), { width: 32 });
await png(join(root, 'public/favicon-32.png'), { width: 32 });
await png(join(root, 'public/icon-192.png'), { width: 192 });
await png(join(root, 'public/icon-512.png'), { width: 512 });
// Apple rounds its own corners: a full square.
await png(join(root, 'site/mark-180.png'), { width: 180, bg: 'square' });
await png(join(root, 'public/apple-touch-icon.png'), { width: 180, bg: 'square' });

// Android launcher icons, per density: the square one, the round one, and the adaptive
// icon's foreground (108 dp, the mark inside the 66 dp circle every mask keeps).
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, scale] of Object.entries(densities)) {
  const dir = join(res, `mipmap-${name}`);
  await png(join(dir, 'ic_launcher.png'), { width: 48 * scale });
  await png(join(dir, 'ic_launcher_round.png'), { width: 48 * scale, bg: 'circle', reach: 0.37 });
  await png(join(dir, 'ic_launcher_foreground.png'), { width: 108 * scale, bg: 'none', reach: 0.278 });
}
await text(
  join(res, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#000000</color>
</resources>
`,
);

// The splash before Android 12 (later, Android draws the launcher icon itself), at the
// sizes TrailCompass's are: black, the mark in the middle.
const splashes = {
  drawable: [480, 320],
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
};
for (const [dir, [width, height]] of Object.entries(splashes)) {
  await png(join(res, dir, 'splash.png'), { width, height, bg: 'square', reach: 0.13 });
}

console.log('RIDECORE icons written.');

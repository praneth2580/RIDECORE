#!/usr/bin/env node
/**
 * Render site/og-image.png (1200×630), the preview shown when the landing
 * page is shared. Reuses the phone illustration from site/index.html.
 *
 * Needs Playwright's Chromium (npx playwright install chromium), or
 * CHROME_PATH set to an installed Chrome, and a connection for the web fonts.
 * Run: node scripts/render-og-image.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'site/index.html'), 'utf8');
const phone = html.match(/<svg\s+id="phone"[\s\S]*?<\/svg>/)?.[0];
if (!phone) throw new Error('No <svg id="phone"> in site/index.html');
const fontsLink = html.match(/<link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com[^>]*>/)?.[0] ?? '';
const styles = readFileSync(join(root, 'site/styles.css'), 'utf8');
const logo = `data:image/svg+xml;base64,${readFileSync(join(root, 'site/mark.svg')).toString('base64')}`;

const page = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    ${fontsLink}
    <style>
      ${styles}
      html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
      .og {
        position: relative;
        width: 1200px;
        height: 630px;
        overflow: hidden;
        background: radial-gradient(ellipse 45% 60% at 80% 52%, rgba(223, 254, 69, 0.13), transparent 70%), #000;
      }
      .og-copy { position: absolute; top: 88px; left: 72px; width: 520px; }
      .og-brand { display: flex; align-items: center; gap: 14px; font-size: 26px; font-weight: 600; letter-spacing: 0.12em; }
      .og-brand img { width: 46px; height: 46px; }
      .og h1 { margin-top: 40px; font-size: 52px; line-height: 1.06; letter-spacing: -0.025em; white-space: nowrap; }
      .og h1 .second { display: block; color: var(--muted); }
      .og-sub { margin-top: 22px; color: var(--copy); font-size: 24px; line-height: 1.4; }
      .og-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 34px; }
      .og-chip { padding: 8px 18px; border: 1.5px solid var(--border-strong); border-radius: 999px; color: var(--copy); font-size: 18px; font-weight: 500; white-space: nowrap; }
      .og-chip-accent { border-color: var(--lime); background: var(--lime); color: var(--lime-ink); }
      .og .phone { position: absolute; top: 172px; left: 600px; width: 570px; transform: rotate(-4deg); }
    </style>
  </head>
  <body>
    <div class="og">
      <div class="og-copy">
        <div class="og-brand"><img src="${logo}" alt="" />RIDECORE</div>
        <h1>Your bike's dash, <span class="second">on a spare phone.</span></h1>
        <p class="og-sub">Speed, the next turn and the trip at a glance. Swiped like a watch.</p>
        <div class="og-chips">
          <span class="og-chip">Voice turn-by-turn</span>
          <span class="og-chip">Ride recorder</span>
          <span class="og-chip og-chip-accent">Free for Android</span>
        </div>
      </div>
      ${phone}
    </div>
  </body>
</html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
try {
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await tab.setContent(page, { waitUntil: 'networkidle' });
  await tab.evaluate(() => document.fonts.ready);
  const png = await tab.screenshot({ type: 'png' });
  const out = join(root, 'site/og-image.png');
  writeFileSync(out, await sharp(png).png({ compressionLevel: 9, palette: true, quality: 92 }).toBuffer());
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
}

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rename, ridecore } from './vite-plugin.ts';

/** A tiny app laid out like this repo, built with the plugin. */
const files: Record<string, string> = {
  'index.html': [
    '<meta name="theme-color" content="#06100c" />',
    '<title>TrailCompass</title>',
    '<script type="module" src="/src/main.tsx"></script>',
  ].join(''),
  // TrailCompass's entry and app: never built.
  'src/main.tsx': "console.log('upstream-entry');",
  // RIDECORE's entry, using TrailCompass's modules.
  'src/ridecore/main.tsx': [
    "import { card } from '../components/Card';",
    "import { untouched } from '../components/Untouched';",
    "import { hint } from '../services/hint';",
    "import { plain } from '../components/Plain';",
    "import { seenByTest } from '../components/plain.test';",
    "import { twin } from '../components/twin.test';",
    'console.log(card, untouched, hint, plain, seenByTest, twin);',
  ].join('\n'),
  // A file in overrides/ at a test's path doesn't replace the test.
  'src/components/twin.test.ts': "export const twin = 'upstream-test';",
  'src/ridecore/overrides/components/twin.test.ts': "export const twin = 'ridecore-test';",
  'src/components/Plain.ts': "export const plain = 'upstream-plain';",
  'src/ridecore/overrides/components/Plain.ts': "export const plain = 'ridecore-plain';",
  // One of TrailCompass's tests: it gets TrailCompass's file, not the override.
  'src/components/plain.test.ts': "import { plain } from './Plain';\nexport const seenByTest = 'test-saw:' + plain;",
  'src/components/Card.ts': "export const card = 'upstream-card';",
  'src/components/Helper.ts': "export const helper = 'upstream-helper';",
  'src/components/Untouched.ts': "export const untouched = 'upstream-untouched';",
  'src/services/hint.ts': "export const hint = 'Open TrailCompass to try again';",
  // Wraps the file it replaces, and uses a neighbour of that file by its relative path.
  'src/ridecore/overrides/components/Card.ts': [
    "import { card as original } from '../../../components/Card';",
    "import { helper } from './Helper';",
    "export const card = ['ridecore-card', original, helper].join(' ');",
  ].join('\n'),
};

let js = '';
let html = '';
let root = '';

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'ridecore-plugin-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [ridecore()],
    build: { write: false, minify: false },
  });
  const output = [result].flat().flatMap((r) => ('output' in r ? r.output : []));
  js = output.map((o) => (o.type === 'chunk' ? o.code : '')).join('\n');
  html = output.map((o) => (o.type === 'asset' && o.fileName === 'index.html' ? String(o.source) : '')).join('');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('ridecore vite plugin', () => {
  it("starts RIDECORE's app, not TrailCompass's", () => {
    expect(js).toContain('upstream-untouched');
    expect(js).not.toContain('upstream-entry');
  });

  it('replaces a file that has an override', () => {
    expect(js).toContain('ridecore-card');
  });

  it('lets an override wrap the file it replaces', () => {
    expect(js).toContain('upstream-card');
  });

  it("resolves an override's relative imports from the file it replaces", () => {
    expect(js).toContain('upstream-helper');
  });

  it("gives TrailCompass's tests TrailCompass's file, and RIDECORE the override", () => {
    expect(js).toContain('upstream-plain');
    expect(js).toContain('ridecore-plain');
  });

  it("never replaces one of TrailCompass's tests", () => {
    expect(js).toContain('upstream-test');
    expect(js).not.toContain('ridecore-test');
  });

  it("shows RIDECORE's name in TrailCompass's text and the page", () => {
    expect(js).toContain('Open RIDECORE to try again');
    expect(html).toContain('<title>RIDECORE</title>');
    expect(html).toContain('content="#000000"');
  });
});

describe('rename', () => {
  it('replaces the name where it is shown', () => {
    expect(rename("'Allow TrailCompass to install updates'")).toBe("'Allow RIDECORE to install updates'");
    expect(rename('<p>TrailCompass</p>')).toBe('<p>RIDECORE</p>');
    expect(rename('`TrailCompass ${version}`')).toBe('`RIDECORE ${version}`');
    expect(rename("TrailCompass's map")).toBe("RIDECORE's map");
  });

  it('keeps URLs pointing at TrailCompass', () => {
    const urls = "'praneth2580/TrailCompass' 'https://praneth2580.github.io/TrailCompass/poi'";
    expect(rename(urls)).toBe(urls);
  });

  it('keeps identifiers and file formats', () => {
    const code = "TrailCompassRouteFile isTrailCompassRouteFile 'trailcompass-route' '.trailcompass.json'";
    expect(rename(code)).toBe(code);
  });
});

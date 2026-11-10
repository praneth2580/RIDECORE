#!/usr/bin/env node
/**
 * RIDECORE's release: build the APK and publish it as a GitHub release on RIDECORE's
 * own repo, tagged ridecore-v<version>. This replaced TrailCompass's script of the same
 * name, which bumps TrailCompass's version lines and makes a "TrailCompass v…" release
 * (.gitattributes keeps this one when TrailCompass is merged; ridecore/README.md →
 * Releasing).
 *
 * RIDECORE's version lives in its tags alone: no file is bumped or committed, so
 * TrailCompass's package.json and build.gradle merge cleanly. The APK gets its version
 * name and code from ridecore/version.gradle.
 *
 * Usage:
 *   npm run release:minor -- --notes "Picked apps a swipe up"
 *   npm run release:major -- --notes-file notes.md
 *   node scripts/release.mjs patch --notes "…"
 *   node scripts/release.mjs minor --pre beta --notes "…"   (1.2.0-beta.1, a pre-release)
 *   node scripts/release.mjs minor --dry-run                 (builds the APK; no tag, push or release)
 *   … --draft                                                 (a draft release, not yet shown)
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { root, runGradle } from './android-env.mjs';

const TAG_PREFIX = 'ridecore-v';
const args = process.argv.slice(2);
const bump = args[0];
const option = (name) => {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  const value = args[at + 1];
  if (!value || value.startsWith('--')) fail(`${name} needs a value`);
  return value;
};
const notesText = option('--notes');
const notesFile = option('--notes-file');
const pre = option('--pre');
const draft = args.includes('--draft');
const dryRun = args.includes('--dry-run');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!['patch', 'minor', 'major'].includes(bump)) {
  fail('Usage: node scripts/release.mjs <patch|minor|major> [--notes "…" | --notes-file notes.md] [--pre beta] [--draft] [--dry-run]');
}
if (notesText && notesFile) fail('Give --notes or --notes-file, not both');
if (notesFile && !existsSync(path.resolve(notesFile))) fail(`No notes file at ${notesFile}`);
if (pre && !/^[a-z]+$/.test(pre)) fail('--pre takes a word: alpha, beta, rc');

function git(gitArgs) {
  return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).trim();
}

function run(cmd, cmdArgs, env = process.env) {
  execFileSync(cmd, cmdArgs, { stdio: 'inherit', cwd: root, env });
}

/** 1.2.3 or 1.2.3-beta.4, as numbers; null for anything else. */
function parseVersion(text) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.(\d+))?$/.exec(text);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null, preNumber: m[5] ? +m[5] : 0 } : null;
}

const format = (v) => `${v.major}.${v.minor}.${v.patch}${v.pre ? `-${v.pre}.${v.preNumber}` : ''}`;

/**
 * Android only installs a higher (or equal) versionCode over what's there. From the
 * version, so it always rises with it: 1.2.3 is 1020399, its betas 10203xx below that.
 */
function versionCode(v) {
  return v.major * 1_000_000 + v.minor * 10_000 + v.patch * 100 + (v.pre ? Math.min(v.preNumber, 98) : 99);
}

// ── Checks, before anything is built ─────────────────────────────────────────

if (git(['status', '--porcelain'])) fail('The working tree has changes. Commit or stash them before releasing.');

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') fail(`Releases go out from main; this is ${branch}.`);

const originUrl = (() => {
  try {
    return git(['remote', 'get-url', 'origin']);
  } catch {
    return fail('No git remote named origin.');
  }
})();
const repoMatch = originUrl.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/);
if (!repoMatch) fail(`origin isn't a GitHub repo: ${originUrl.replace(/\/\/[^@]+@/, '//')}`);
// Named outright: with TrailCompass as a second remote, gh can't tell which repo is meant.
const repo = repoMatch[1];
if (!/ridecore/i.test(repo)) fail(`origin is ${repo}, not RIDECORE's repo.`);

// gh signs in with GH_TOKEN, else the token in origin's URL, else its own login.
const token = originUrl.match(/^https:\/\/([^@]+)@github\.com\//)?.[1];
const ghEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || !token ? process.env : { ...process.env, GH_TOKEN: decodeURIComponent(token) };

// Up to date with GitHub: every tag (a release made elsewhere) and main not behind.
run('git', ['fetch', '--quiet', 'origin', 'main', '--tags']);
if (git(['rev-list', '--count', 'HEAD..origin/main']) !== '0') fail('main is behind origin/main. Pull first.');

if (!dryRun) {
  const probe = spawnSync('gh', ['release', 'list', '--repo', repo, '--limit', '1'], { cwd: root, env: ghEnv, encoding: 'utf8' });
  if (probe.error) fail('GitHub CLI (gh) is not installed or not on PATH.');
  if (probe.status !== 0) fail(`GitHub CLI can't reach ${repo}. Set GH_TOKEN, or sign in with gh auth login.\n${probe.stderr}`);
}

// ── The version: the newest release's, bumped ────────────────────────────────

const released = git(['tag', '--list', `${TAG_PREFIX}*`])
  .split('\n')
  .map((tag) => parseVersion(tag.slice(TAG_PREFIX.length)))
  .filter(Boolean)
  .sort((a, b) => versionCode(b) - versionCode(a));
const stable = released.find((v) => !v.pre) ?? { major: 0, minor: 0, patch: 0, pre: null, preNumber: 0 };
const base =
  bump === 'major'
    ? { major: stable.major + 1, minor: 0, patch: 0 }
    : bump === 'minor'
      ? { major: stable.major, minor: stable.minor + 1, patch: 0 }
      : { major: stable.major, minor: stable.minor, patch: stable.patch + 1 };
// A pre-release counts up from the last of its kind: 1.2.0-beta.1, then beta.2.
const preNumber = pre
  ? 1 + Math.max(0, ...released.filter((v) => v.major === base.major && v.minor === base.minor && v.patch === base.patch && v.pre === pre).map((v) => v.preNumber))
  : 0;
const next = { ...base, pre: pre ?? null, preNumber };
const version = format(next);
const code = versionCode(next);
const tag = `${TAG_PREFIX}${version}`;
if (git(['tag', '--list', tag])) fail(`${tag} already exists.`);
console.log(`RIDECORE ${released[0] ? format(released[0]) : '(none)'} -> ${version} (versionCode ${code})${dryRun ? ', dry run' : ''}`);

// ── The APK ──────────────────────────────────────────────────────────────────

console.log('Building the APK…');
run('npm', ['run', 'build']);
run('npx', ['cap', 'sync', 'android']);
runGradle([
  'assembleDebug',
  '--init-script',
  path.join(root, 'ridecore', 'version.gradle'),
  `-Pridecore.versionName=${version}`,
  `-Pridecore.versionCode=${code}`,
]);
const built = path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
if (!existsSync(built)) fail(`No APK at ${built}`);
const apk = path.join(path.dirname(built), `ridecore-${version}.apk`);
copyFileSync(built, apk);
console.log(`APK ${path.relative(root, apk)}`);

if (dryRun) {
  console.log(`Dry run: not tagged, pushed or released. It would be ${tag}, "RIDECORE ${version}", on ${repo}.`);
  process.exit(0);
}

// ── Tag, push, release ───────────────────────────────────────────────────────

run('git', ['tag', tag]);
run('git', ['push', 'origin', 'HEAD:main', tag]);

const releaseArgs = ['release', 'create', tag, apk, '--repo', repo, '--title', `RIDECORE ${version}`, '--verify-tag'];
if (notesFile) releaseArgs.push('--notes-file', path.resolve(notesFile));
else releaseArgs.push('--notes', notesText ?? `RIDECORE ${version}`);
if (next.pre) releaseArgs.push('--prerelease');
if (draft) releaseArgs.push('--draft');
run('gh', releaseArgs, ghEnv);

const url = execFileSync('gh', ['release', 'view', tag, '--repo', repo, '--json', 'url', '--jq', '.url'], { cwd: root, env: ghEnv, encoding: 'utf8' }).trim();
console.log(`Published ${tag}`);
console.log(url);

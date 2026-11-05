/**
 * RIDECORE's one hook into TrailCompass's build. See ridecore/README.md.
 *
 * RIDECORE is its own app with TrailCompass as its engine. It merges TrailCompass
 * regularly, so it adds files instead of editing TrailCompass's. This plugin:
 *
 * - Entry: index.html starts src/ridecore/main.tsx, RIDECORE's app, instead of
 *   TrailCompass's src/main.tsx. TrailCompass's screens stay in the repo, unbuilt.
 * - Overrides: src/ridecore/overrides/<path> replaces src/<path> wherever it is
 *   imported, except in tests, which get the file they name. A relative import in an override
 *   that finds nothing beside it resolves from src/<path> instead, so a copied
 *   TrailCompass file works as is.
 * - Name: "TrailCompass" in TrailCompass's code and index.html becomes RIDECORE
 *   (rename()), so text its services show (notifications, share messages, errors)
 *   needs no edits.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { normalizePath, type Plugin } from 'vite';

export const APP_NAME = 'RIDECORE';

const UPSTREAM_ENTRY = 'src="/src/main.tsx"';
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
export const ENTRY = 'src="/src/ridecore/main.tsx"';

/**
 * Puts RIDECORE's name where TrailCompass's is shown. Only the word on its own:
 * not in a URL or path ("/TrailCompass", TrailCompass's releases and data stay
 * where they are), and not inside identifiers like TrailCompassRouteFile. The
 * lowercase "trailcompass" in file formats, storage keys and layer ids is left
 * alone, so the two apps still open each other's files.
 */
export function rename(text: string): string {
  return text.replace(/(?<![\w/.-])TrailCompass(?![\w-])/g, APP_NAME);
}

export function ridecore(): Plugin {
  let src = '';
  let overrides = '';

  /** The override for a file under src/, if there is one. */
  function overrideOf(file: string): string | undefined {
    const rel = normalizePath(path.relative(src, file));
    if (rel.startsWith('..') || path.isAbsolute(rel) || rel.startsWith('ridecore/')) return undefined;
    // TrailCompass's tests always run as they are, whatever sits at their path in overrides/.
    if (TEST_FILE.test(rel)) return undefined;
    const candidate = `${overrides}/${rel}`;
    return existsSync(candidate) ? candidate : undefined;
  }

  return {
    name: 'ridecore',
    enforce: 'pre',

    configResolved(config) {
      src = normalizePath(path.join(config.root, 'src'));
      overrides = `${src}/ridecore/overrides`;
    },

    configureServer(server) {
      // Imports resolved before an override was added or removed would keep the old file.
      const restart = (file: string) => {
        if (normalizePath(file).startsWith(`${overrides}/`)) void server.restart();
      };
      server.watcher.on('add', restart).on('unlink', restart);
    },

    async resolveId(source, importer, options) {
      if (!importer || importer.startsWith('\0') || source.startsWith('\0')) return null;
      const from = normalizePath(importer.split('?')[0]!);
      let resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved && source.startsWith('.') && from.startsWith(`${overrides}/`)) {
        const replaced = `${src}/${from.slice(overrides.length + 1)}`;
        resolved = await this.resolve(source, replaced, { ...options, skipSelf: true });
      }
      if (!resolved || resolved.external) return resolved;

      const queryAt = resolved.id.indexOf('?');
      const file = queryAt === -1 ? resolved.id : resolved.id.slice(0, queryAt);
      const override = overrideOf(file);
      // An override importing the file it replaces gets that file, so it can wrap it.
      if (!override || override === from) return resolved;
      // A test gets the very file it names: TrailCompass's tests test TrailCompass's code,
      // and RIDECORE's can compare an override with the file it replaces.
      if (TEST_FILE.test(from)) return resolved;
      return queryAt === -1 ? override : override + resolved.id.slice(queryAt);
    },

    transform(code, id) {
      const file = normalizePath(id.split('?')[0]!);
      const ours = file.startsWith(`${src}/ridecore/`);
      if (!file.startsWith(`${src}/`) || ours || !/\.[cm]?[jt]sx?$/.test(file)) return null;
      const out = rename(code);
      if (out === code) return null;
      // A rename shifts the columns after it on its line; every line stays where it was.
      return { code: out, map: null };
    },

    transformIndexHtml: {
      // Before Vite reads the page's scripts, so it builds from RIDECORE's entry.
      order: 'pre',
      handler(html) {
        if (!html.includes(UPSTREAM_ENTRY)) {
          // Fail the build rather than quietly ship TrailCompass's app.
          throw new Error(`ridecore: index.html no longer has ${UPSTREAM_ENTRY}; point the swap at its new entry`);
        }
        return rename(html.replace(UPSTREAM_ENTRY, ENTRY).replace(/(name="theme-color" content=")[^"]*"/, '$1#000000"'));
      },
    },
  };
}

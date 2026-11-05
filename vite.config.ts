import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';
import { resolveMapTheme } from './src/theme/map-theme-core.ts';
import { ridecore } from './ridecore/vite-plugin.ts';

/**
 * Checks the map theme env (src/theme/map-theme-core.ts) where it was set.
 * A bad value stops the build, so an APK never ships with a colour skipped;
 * the dev server only warns.
 */
function checkMapTheme(): Plugin {
  return {
    name: 'trailcompass:map-theme',
    configResolved(config) {
      const { problems } = resolveMapTheme(config.env);
      if (problems.length === 0) return;
      const list = problems.map((problem) => `  - ${problem}`).join('\n');
      if (config.command === 'build') {
        throw new Error(`Map theme: fix these in .env.local or the shell:\n${list}`);
      }
      config.logger.warn(`Map theme: these were ignored:\n${list}`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // ridecore(): starts RIDECORE's app on TrailCompass's engine (ridecore/README.md).
  plugins: [react(), checkMapTheme(), ridecore()],
  // Relative base so assets resolve correctly inside the Capacitor Android WebView.
  base: './',
  server: {
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    // Empty by default, ?raw too. index-css.test.ts reads the real stylesheets.
    css: { include: [/\.css\?raw$/] },
    // *.scratch.test.ts files query live OSM servers and can run for many
    // minutes. They only run with LIVE_OSM=1, e.g. `LIVE_OSM=1 npm test`.
    exclude: [
      ...configDefaults.exclude,
      ...(process.env.LIVE_OSM ? [] : ['**/*.scratch.test.ts']),
    ],
  },
});

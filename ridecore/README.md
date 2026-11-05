# RIDECORE

RIDECORE is its own app: its own screens, look and flow. TrailCompass is its engine:
routing, turn-by-turn, offline maps, GPS, ride recording, storage and the Android plugins
behind them. TrailCompass lives in this repo as the `upstream` remote, and its changes are
merged in regularly. To keep those merges clean:

**Don't edit TrailCompass's files. RIDECORE's code lives in its own.**

A merge only conflicts where both sides changed the same lines. TrailCompass never touches
RIDECORE's files, so they never conflict.

| What | Where |
| --- | --- |
| RIDECORE's app: entry, shell, screens, components | `src/ridecore/` |
| Its look | `src/ridecore/styles/ridecore.css` |
| The door to TrailCompass's engine | `src/ridecore/engine.ts` |
| A TrailCompass file that has to change (last resort) | `src/ridecore/overrides/<same path as under src/>` |
| RIDECORE's Android code | `android/app/src/main/java/com/praneth2580/ridecore/` |
| Build tooling | `ridecore/` |

## How it fits together

- `index.html` is TrailCompass's. `ridecore/vite-plugin.ts` makes it start
  `src/ridecore/main.tsx` instead of TrailCompass's `src/main.tsx`. TrailCompass's screens
  (`src/app/`, most of `src/components/`) stay in the repo, still type-checked and tested,
  but aren't built into the app.
- RIDECORE's screens import TrailCompass only through `src/ridecore/engine.ts`. When a
  merge changes one of TrailCompass's APIs, the type check fails there, and that file is
  where RIDECORE adapts.
- `src/ridecore/app/useRideCore.ts` starts the engine the way TrailCompass's `App.tsx`
  does: GPS into navigation, navigation into voice guidance, ride recording, the planning
  notification. If TrailCompass adds start-up work to its `App.tsx`, mirror it here.
- TrailCompass's stylesheet (`src/index.css`) still loads, for what the map draws itself:
  markers, place popups, the map's credit. `ridecore.css` sets TrailCompass's `--tc-*`
  tokens to RIDECORE's colours so those match.

RIDECORE is a navigation device, not an app with pages: one screen
(`src/ridecore/app/App.tsx`) with a status line, the speed dial, the live map with the
next turn over it, and the trip, plus a few round buttons that change with what's
happening (Where to / Start / End / voice / record / menu). TrailCompass's fuel and food
pins start switched off (Settings switches them on), so the map stays clean.
Everything else opens in a sheet over it: Where to (search, saved trips), the menu
(past rides, settings), the ride's controls, and "End navigation?". Landscape lays the
speed, road and trip side by side; portrait stacks them.

## The phone it runs on

RIDECORE is made for a phone kept for it alone, as that phone's home screen.

- **Layout.** The first start asks how the phone is mounted, landscape or portrait;
  Settings → Screen changes it. `RideCoreDevicePlugin` (Java) keeps the choice and holds
  the screen that way, either way up, from the moment the app starts.
- **Home screen.** RIDECORE can be Android's home app: Settings → Home screen → Choose,
  then pick RIDECORE. Home and switching the phone on then open it, and Back stops at the
  dashboard.
- **Screen on.** On all the time unless Settings → Keep the screen on is off.
- **The way out.** Settings → Android settings opens the phone's own settings (Wi-Fi,
  Bluetooth, and Apps → Default apps → Home app to give the home screen back).

In a browser the choice is kept but nothing is locked: the window decides the layout.

## The name

TrailCompass's services say "TrailCompass" in text the rider sees: notifications, share
messages, errors, the GPX creator. The plugin's `rename()` puts "RIDECORE" there as it
builds, so none of that text is edited here and text TrailCompass adds later is covered
too. The source still reads "TrailCompass"; the app shows "RIDECORE".

It replaces only the word on its own. Left alone:

- URLs and paths, e.g. `praneth2580/TrailCompass`: the fuel and food data still come from
  TrailCompass's site.
- Identifiers like `TrailCompassRouteFile`.
- Lowercase `trailcompass` in file formats (`.trailcompass.json`), storage keys and map
  layer ids, so RIDECORE and TrailCompass still open each other's trip files.

RIDECORE's own code (`src/ridecore/`) writes "RIDECORE" itself and isn't touched.

## Overrides

Only for when RIDECORE needs a TrailCompass module itself to behave differently. Copy it
to the same path under `src/ridecore/overrides/` and edit the copy: every import of the
original then gets the copy, and the copy's imports work unchanged. To wrap the original
instead, import it by its real path, e.g. `../../../services/map.service`.

An override takes the file out of TrailCompass's updates, so prefer changing TrailCompass
itself when the change makes sense there, and check overridden files after every merge
(below). Better still, wrap: re-export the original and replace only what must change.

Tests are left alone: a test always gets the very file it names, and nothing in
`overrides/` replaces a test. TrailCompass's tests keep testing TrailCompass's code.

Overrides in use:

- `services/nav-display.ts`: wraps TrailCompass's and pulls the navigation zoom back
  1.3 levels (`ZOOM_OUT`), since RIDECORE's map is under half the screen TrailCompass
  zooms for. Everything else in the file is TrailCompass's, re-exported.
  Test: `src/ridecore/nav-zoom.test.ts`.
- `theme/map-theme.ts`: TrailCompass's, resolving RIDECORE's map colours (below) under
  the build's env instead of TrailCompass's defaults.

## Map colours

TrailCompass's map theme (`src/theme/`, `.env.example`, DEVELOPMENT.md → "Theming the
map") colours the basemap, routes and markers. RIDECORE's colours are
`RIDECORE_MAP_THEME` in `src/ridecore/map-theme.ts`: TrailCompass's `dark` preset
underneath, RIDECORE's neutral black, green route and lime rider over it. A build's env
(`VITE_MAP_THEME`, `VITE_MAP_THEME_JSON`, `VITE_MAP_COLOR_*` in `.env.local` or the
shell) still wins over them. Test: `src/ridecore/map-theme.test.ts`.

## Pulling in TrailCompass

```bash
git fetch upstream
git merge upstream/main

# Overridden files whose TrailCompass original just changed: carry the change over by hand.
git diff --name-only ORIG_HEAD HEAD -- src | while read -r f; do
  [ -e "src/ridecore/overrides/${f#src/}" ] && echo "$f"
done

# What TrailCompass's app does at start-up, in case RIDECORE should do it too:
# src/main.tsx → src/ridecore/main.tsx, src/app/App.tsx → src/ridecore/app/useRideCore.ts.
git diff ORIG_HEAD HEAD -- src/main.tsx src/app/App.tsx

npm test && npm run build
git push
```

## Where RIDECORE edits TrailCompass's files

Keep this list short and current. These are the only places a merge can conflict.

- `vite.config.ts`: adds `ridecore()` to `plugins`.
- `tsconfig.app.json`: `rootDirs`, so TypeScript resolves an override's imports the way
  the plugin does.
- App ID `com.praneth2580.ridecore`: `appId` in `capacitor.config.ts`, `applicationId` in
  `android/app/build.gradle`, `appId` and the launch line in `scripts/android-run.mjs`.
  Only the ID Android and the Play Store see changed. The Java code keeps TrailCompass's
  `com.praneth2580.trailcompass` package (`namespace` in `build.gradle`) so its files merge
  as they are; any new Java file TrailCompass adds goes in that same package.
- `MainActivity.java`: one line registering `RideCoreDevicePlugin`, at the top of `onCreate`.
- `AndroidManifest.xml`: a second intent filter on `MainActivity` (HOME, DEFAULT), so
  RIDECORE can be the home screen. TrailCompass's launcher filter is untouched.
- Name "RIDECORE": `app_name` and `title_activity_main` in
  `android/app/src/main/res/values/strings.xml` (the name under the app icon), and
  `appName` and `appendUserAgent` in `capacitor.config.ts` (how the app names itself to
  OpenFreeMap).

To check for others: `git diff --stat upstream/main -- . ':!ridecore' ':!src/ridecore'`

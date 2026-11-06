# Developing RIDECORE

How to build, run, test and release RIDECORE, and how its website is published. Three other documents go with this one:

- **[ridecore/README.md](ridecore/README.md):** the rules for building on TrailCompass. It covers where RIDECORE's code goes, overrides, the name, merging TrailCompass in, and releasing. Read it before your first change.
- **[docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md):** RIDECORE's code, file by file: the shell, each screen, the components, the Android plugin, storage and tests.
- **TrailCompass's own docs**, for the engine underneath: routing, navigation, offline maps, GPS, ride recording and the fuel and food data. Read them [on GitHub](https://github.com/praneth2580/TrailCompass/blob/main/DEVELOPMENT.md), or locally with `git show upstream/main:DEVELOPMENT.md` and `git show upstream/main:docs/PROJECT_GUIDE.md` after a `git fetch upstream`.

- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [npm scripts](#npm-scripts)
- [Project layout](#project-layout)
- [How it fits together](#how-it-fits-together)
- [Android builds](#android-builds)
- [Releasing a new version](#releasing-a-new-version)
- [The website on GitHub Pages](#the-website-on-github-pages)
- [Docs, the site and merges](#docs-the-site-and-merges)
- [Map colours](#map-colours)
- [Testing](#testing)
- [External services](#external-services)
- [Known issues and gotchas](#known-issues-and-gotchas)
- [Safety, licensing and contributing](#safety-licensing-and-contributing)

## Tech stack

| Area | Technology |
|---|---|
| UI | React 19, TypeScript 6, plain CSS (`src/ridecore/styles/ridecore.css`, tokens in `:root`), the Lexend font |
| Build | Vite 8, with `ridecore/vite-plugin.ts` starting RIDECORE instead of TrailCompass |
| Engine | TrailCompass, in this repo as the `upstream` remote: on-device routing (A\* over OpenStreetMap roads from Overpass), turn-by-turn, voice, GPS, ride recording, storage |
| Native shell | Capacitor 7, Android only (min Android 6.0, SDK 23; target SDK 35) |
| Android plugins | RIDECORE's `RideCoreDevicePlugin` (layout lock, home screen, the phone's apps, the phone's music, signal and headset), TrailCompass's `AppUpdaterPlugin`, `DownloadsPlugin`, `MapFilesPlugin` and `RideLocationPlugin`, and Capacitor's Geolocation, Filesystem, Preferences, Share, App, Keep Awake and Text-to-Speech |
| Map | MapLibre GL JS 6 with OpenFreeMap's Liberty style, recoloured in RIDECORE's colours |
| Tests and lint | Vitest 4 (Node environment), oxlint |
| Hosting | GitHub Releases (APKs, as pre-releases) and GitHub Pages (website and APK copy) |

## Requirements

- **Node.js 20+** and npm 10.
- **For Android builds:** JDK 21 and the Android SDK (platform 35). The scripts find the SDK through `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and the JDK through `JAVA_HOME`, `TRAILCOMPASS_JAVA_HOME` or its usual install folders. See [the Gradle JDK gotcha](#known-issues-and-gotchas).
- **For releases:** the GitHub CLI, signed in (`gh auth login`).
- **A spare Android phone.** Being the home screen, holding the layout, listing and opening the phone's apps, following the phone's music, GPS, voice and recording with the screen off only happen on a device.

## Quick start

```bash
git clone https://github.com/praneth2580/RIDECORE.git
cd RIDECORE
git remote add upstream https://github.com/praneth2580/TrailCompass.git
git config merge.ours.driver true   # once per clone: see "Docs, the site and merges"
npm install        # "ERESOLVE overriding peer dependency" warnings are expected
npm run dev        # http://localhost:5173 (GPS needs localhost or https)
npm test
```

In a browser the window decides the layout: make it wider than tall for landscape. The first start still asks how the phone is mounted, and the choice is kept, but nothing is locked. There are no phone apps to list and no Home button, so the launcher parts only show on a phone.

## npm scripts

The scripts are TrailCompass's. Most work for RIDECORE as they are.

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server (also reachable from your LAN) |
| `npm run build` | Type-check (`tsc -b`) and build RIDECORE into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |
| `npm test` | Vitest: RIDECORE's tests and TrailCompass's. `LIVE_OSM=1 npm test` also runs the slow tests that call live OpenStreetMap servers |
| `npm run cap:sync` | Build, then copy the web app into the Android project |
| `npm run cap:build` | Sync, then assemble the debug APK |
| `npm run cap:emulator` | Start an emulator (`ANDROID_AVD`, or the default AVD) |
| `npm run cap:install` | Install the debug APK on a connected phone or emulator |
| `npm run cap:run` | Build, sync, assemble, install and launch |
| `npm run site:build` | Assemble RIDECORE's website into `_site/` |
| `npm run site:preview` | Build the website and serve it locally (port 4173) |
| `npm run site:og` | Re-render the share image `site/og-image.png` |
| `npm run data:poi` | Rebuild the bundled fuel and food data (TrailCompass's; see its DEVELOPMENT.md) |
| `npm run icons:generate` | Regenerate the app icons from `resources/`. They are still TrailCompass's |
| `npm run release:minor` / `release:major` | **Not for RIDECORE.** They bump TrailCompass's version and publish a "TrailCompass" release. See [Releasing](#releasing-a-new-version) |

## Project layout

```text
ridecore/                     RIDECORE's build tooling: the Vite plugin, the APK version script, its README
src/ridecore/                 RIDECORE's app
  main.tsx                    Entry point (the Vite plugin starts this instead of src/main.tsx)
  app/                        The shell (App.tsx), engine start-up (useRideCore.ts), battery
  screens/                    Music, Settings, Apps, Where to, Trip, Rides, the first-start layout picker
  components/                 Pager, Page, Key, map zone, speed dial, status line, route panel, recorder, icons…
  engine.ts                   The one door into TrailCompass
  overrides/                  TrailCompass modules RIDECORE replaces (same paths as under src/)
  styles/ridecore.css         RIDECORE's look
  media.ts, radio.ts, weather.ts, status.ts, glow.ts, dash.ts, recent.ts, …
                              Small modules, each with its test
android/app/src/main/java/com/praneth2580/ridecore/
                              RideCoreDevicePlugin.java, RideCoreMedia.java, RideCoreMediaListener.java,
                              RideCoreStatus.java
docs/PROJECT_GUIDE.md         RIDECORE's code, file by file
site/                         RIDECORE's website: static HTML, CSS, a small script and images
.github/workflows/pages.yml   Publishes the website and its APK copy

TrailCompass's engine (edit only through upstream; see ridecore/README.md):
src/services/ src/routing/ src/offline/ src/database/ src/hooks/ src/theme/ src/types/
src/app/ src/components/      TrailCompass's own screens: type-checked and tested, not built into RIDECORE
android/…/trailcompass/       TrailCompass's Android plugins (RIDECORE keeps their package)
public/assets/poi/            Fuel and food data for India (Overture Maps), with sources and licences
scripts/                      Android build and run, data, icons and website builders
```

## How it fits together

RIDECORE is its own app on TrailCompass's engine. `index.html` is TrailCompass's, but `ridecore/vite-plugin.ts` makes it start `src/ridecore/main.tsx`. RIDECORE's screens reach the engine only through `src/ridecore/engine.ts`. When a TrailCompass merge changes an API, the type check fails there, and that's the one place RIDECORE adapts. `src/ridecore/app/useRideCore.ts` starts the engine the way TrailCompass's `App.tsx` does, minus TrailCompass's update check.

The app is the phone's home screen, worked like a watch. Two `Pager`s in `src/ridecore/app/App.tsx` lay the screens out as a plus around the dash. Across: music, the dash, Where to (or the trip while navigating), then Rides, with the ride recorder on top. Down the dash's column: settings above, the phone's apps below; while either is open, sideways swipes do nothing, and the way back to the dash is the way in. The dash comes back on Home, after 30 s alone, and when a turn or the destination is near. Choosing a route takes the whole screen, with the route panel over the map.

The [Project Guide](docs/PROJECT_GUIDE.md) goes through all of this file by file. [ridecore/README.md](ridecore/README.md) explains the rules that keep TrailCompass merges clean, and lists every TrailCompass file RIDECORE edits.

## Android builds

```bash
npm run cap:run          # build, sync, assemble, install and launch the debug APK
```

Or one step at a time: `npm run cap:sync`, `npm run cap:build`, `npm run cap:install`. To work in Android Studio, run `npx cap open android`. If no phone is connected, `cap:install` and `cap:run` start an emulator; set `ANDROID_AVD` to choose which one.

- **App ID** `com.praneth2580.ridecore`, so RIDECORE installs next to TrailCompass. The Java code keeps TrailCompass's `com.praneth2580.trailcompass` package (`namespace` in `build.gradle`) so its files merge as they are.
- **RIDECORE's native code** is in `android/app/src/main/java/com/praneth2580/ridecore/`. `RideCoreDevicePlugin.java` holds the screen in the chosen layout from start-up, reports and opens the home-app setting, lists the phone's apps with their icons (`listApps`), opens one (`openApp`), opens Android's settings, and tells the web side when Home is pressed (the `home` event). It is registered in `MainActivity.onCreate`. `RideCoreMedia.java` follows the phone's media sessions for the Music screen: what plays and its controls. Seeing what plays needs notification access, which only the rider can give (Settings → Music info opens Android's screen for it). `RideCoreMediaListener` is the service that access is given to; it does nothing itself. Without access, play, pause and skip are still sent, as a headset's media buttons are. `RideCoreStatus.java` reports what the dash's corners show: a SIM and its signal level, Wi-Fi, offline or airplane mode, and a connected headset (Bluetooth or wired). It reads the signal's level only, not the network type, so it needs no permission (the type would need `READ_PHONE_STATE`).
- **Manifest additions:** a second intent filter on `MainActivity` (HOME, DEFAULT), so RIDECORE can be the home app; a `<queries>` entry for launcher activities, so Android 11 and later let it list the phone's apps; and the `RideCoreMediaListener` service.
- **TrailCompass's native code** (`AppUpdaterPlugin`, `DownloadsPlugin`, `MapFilesPlugin`, `RideLocationPlugin` and the services behind them) is described in [TrailCompass's DEVELOPMENT.md](https://github.com/praneth2580/TrailCompass/blob/main/DEVELOPMENT.md#android-builds).
- **Trying the launcher.** On the phone: Settings (pull down from the dash) → Home app → RIDECORE. To give the home screen back, use Settings → Phone settings, or from a computer run `adb shell am start -a android.settings.HOME_SETTINGS`.

## Releasing a new version

RIDECORE's releases are GitHub pre-releases on praneth2580/RIDECORE. Each is tagged `ridecore-v<version>`, so it never clashes with TrailCompass's `v<version>` tags, and carries one APK named `ridecore-<version>.apk`. The full steps, with the APK version script `ridecore/version.gradle`, are in [ridecore/README.md → Releasing](ridecore/README.md#releasing). Don't use `npm run release:*`: those publish TrailCompass.

Publishing the release starts the Pages workflow, which copies the APK onto the website (below). From then on the website's download buttons offer it. RIDECORE has no in-app updater: TrailCompass's would offer TrailCompass's APKs, so `useRideCore.ts` leaves it out. Riders install each new APK over the old one.

**Keep the signing key.** Releases are debug builds signed with the debug key of the machine that built them. Android only installs an update signed with the same key as the installed app. Build every release on the same machine, or set up a release keystore before you switch.

## The website on GitHub Pages

The site at <https://praneth2580.github.io/RIDECORE/> is published by `.github/workflows/pages.yml` ("Publish site"). Pages replaces the whole site on every publish, so one workflow publishes everything together:

| Path | Contents |
|---|---|
| `/` | RIDECORE's landing page, built from `site/` by `scripts/build-site.mjs` |
| `download/latest.json`, `download/*.apk` | A copy of the newest `ridecore-v*` release, pre-releases included. GitHub's own release downloads are slow or stall on many mobile networks; Pages is served through a CDN |
| `poi/manifest.json`, `poi/<release>/…` | The fuel and food data, as TrailCompass's workflow builds it. RIDECORE's app downloads its updates from TrailCompass's site, so this copy is only a by-product |

The workflow runs:

- **When a release is published:** republishes so the site serves the new APK.
- **On a push to `main` that changes the website:** republishes it.
- **Every Monday:** rebuilds the fuel and food data when Overture has a new release.
- **From Actions → Publish site → Run workflow:** republishes now; tick "force" to rebuild the data too.

On the page, `site/main.js` points the download buttons at `download/latest.json`. If that's missing, it falls back to the newest `ridecore-v*` release with an APK from GitHub's API. Without JavaScript the buttons open the releases page.

One-time setup: in the repository, go to Settings → Pages → Build and deployment and set Source to **GitHub Actions**. RIDECORE's repository already has this.

Working on the site:

- `npm run site:preview` builds it and serves it at <http://localhost:4173>. The download buttons fall back to GitHub there, since there's no `download/` folder locally.
- The phone in the hero is an inline SVG (`<svg id="phone">` in `site/index.html`), drawn after the landscape dash. After changing it, run `npm run site:og` to redraw `site/og-image.png`, which the README shows too. It needs Playwright's Chromium (`npx playwright install chromium`), or `CHROME_PATH` pointing at an installed Chrome.
- `site/mark.svg` is the site's icon, a lime dial. `mark-32.png` and `mark-180.png` are renders of it, made with sharp. The app icon is still TrailCompass's.
- `site/qr.svg` encodes the site's address. To make it again: `npx --yes qrcode@1.5.4 -t svg -q 0 -e M -d 000000ff -l 00000000 -o site/qr.svg https://praneth2580.github.io/RIDECORE/`.
- Check every change at 360 px wide as well as on a desktop.

## Docs, the site and merges

`README.md`, this file, `docs/PROJECT_GUIDE.md`, `site/` and `scripts/render-og-image.mjs` started as TrailCompass's and are now RIDECORE's own. `.gitattributes` marks them `merge=ours`, so merging TrailCompass keeps RIDECORE's versions and never conflicts on them. That only works once the driver is set up in each clone:

```bash
git config merge.ours.driver true
```

Without it, git merges these files line by line as usual and they conflict. TrailCompass's changes to its own docs and site are dropped by the merge, not lost: [ridecore/README.md → Pulling in TrailCompass](ridecore/README.md#pulling-in-trailcompass) shows how to list them after a merge and carry over anything RIDECORE needs.

`scripts/build-site.mjs` and `pages.yml` are still shared with TrailCompass and merge normally. RIDECORE changes a few lines in each (listed in [ridecore/README.md](ridecore/README.md#where-ridecore-edits-trailcompasss-files)).

## Map colours

TrailCompass's map theme colours the basemap, routes and markers. RIDECORE's colours are `RIDECORE_MAP_THEME` in `src/ridecore/map-theme.ts`: TrailCompass's `dark` preset underneath, with RIDECORE's black, green route and lime rider over it. A build's env (`VITE_MAP_THEME`, `VITE_MAP_THEME_JSON`, `VITE_MAP_COLOR_*` in `.env.local` or the shell) still wins over them. The variables and every colour's name are listed in [TrailCompass's DEVELOPMENT.md → Theming the map](https://github.com/praneth2580/TrailCompass/blob/main/DEVELOPMENT.md#theming-the-map). The interface's own colours are the tokens in `:root` of `src/ridecore/styles/ridecore.css`.

## Testing

- **Unit tests:** `npm test`. RIDECORE's sit next to its code (`src/ridecore/*.test.ts`, `ridecore/vite-plugin.test.ts`). They cover the dash's parts, recent places, the turns list, the turn glow, the phone's status, music, radio and weather, the zoom by speed, the map colours, the stylesheet and the Vite plugin. TrailCompass's tests run too and keep testing the engine.
- **Before a release:** `npm run lint`, `npm run build` and `npm test`.
- **On a phone, check:**
  - The first start asks for the layout, and the screen holds it either way up.
  - Every screen in landscape and portrait.
  - With RIDECORE as the home app: Home returns to the dash, and Back never leaves it.
  - Swiping up lists the phone's apps, and they open and pin.
  - The dash comes back after 30 s alone, and when a turn is near.
  - Voice prompts come through a headset, and the headset shows in the dash's corner.
  - The corners follow the signal: SIM bars, Wi-Fi, airplane mode, no connection.
  - A turn coming up lights the screen's edge on its side.
  - The Music screen follows a music app, with and without notification access. A radio station plays, and starting it pauses the phone's music.
  - A ride keeps recording with the screen off.
  - The screen stays on.

## External services

| Service | Used for | Notes |
|---|---|---|
| [OpenFreeMap](https://openfreemap.org) | Map tiles, fonts and icons | No API key. The app names itself "RIDECORE" in its User-Agent (`capacitor.config.ts`) |
| [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) | Road data for planning routes | Public servers that are often busy |
| [Nominatim](https://nominatim.org) | Place search | At most 1 request per second |
| [Open-Meteo](https://open-meteo.com) | The weather (`src/ridecore/weather.ts`) | No key. Every 15 minutes, with the position rounded to about 5 km. Attribution: "Weather data by Open-Meteo.com" (CC BY 4.0) |
| [Radio Browser](https://www.radio-browser.info) | Radio stations (`src/ridecore/radio.ts`) | No key. An open directory; only HTTPS streams are played, since mixed content is off |
| TrailCompass's website | Fuel and food data updates | `poi/manifest.json` on praneth2580.github.io/TrailCompass |
| GitHub Pages and Releases | RIDECORE's website and APKs | The unauthenticated API allows 60 requests an hour per IP |

## Known issues and gotchas

- **Gradle and JDK 21.** The build needs JDK 21 for the Gradle daemon too. If `~/.gradle/gradle.properties` sets `org.gradle.java.home` to another JDK, that wins: remove the line, or pass `-Dorg.gradle.java.home=/path/to/jdk-21` to `./gradlew`.
- **Adding an npm package needs `--legacy-peer-deps`.** `@jansoft/mbujkanji-valhalla-wasm` depends on `@vitest/browser-*@latest`, which conflicts with the project's Vitest. A plain `npm install` from the lockfile only warns.
- **What RIDECORE doesn't do yet** (saving and sharing trips, offline maps, stops, exporting rides, its own icon): [Project Guide §15](docs/PROJECT_GUIDE.md#15-known-gaps). The engine's own open issues are in [TrailCompass's guide §19](https://github.com/praneth2580/TrailCompass/blob/main/docs/PROJECT_GUIDE.md#19-known-issues-and-gaps).

## Safety, licensing and contributing

**Safety.** RIDECORE is not a certified navigation or safety system, and the app's README and website both say so. It's made to be glanced at, so don't add anything that asks the rider to work the phone while moving. New features become a screen to swipe to, or content on an existing one, rather than more buttons on the dash.

**Map data and attribution.** OpenStreetMap data is under the ODbL. Show attribution for every source: OpenStreetMap contributors, OpenFreeMap, the Overture Maps Foundation and its providers. Don't bulk-download tiles from the public OpenStreetMap tile servers: their policy forbids it.

**Contributing.** Before proposing a change:

1. Describe the behaviour or bug.
2. Run `npm run lint`, `npm run build` and `npm test`, and test on Android where it matters, in both layouts.
3. Keep RIDECORE's code in RIDECORE's files ([ridecore/README.md](ridecore/README.md)). A fix to the engine belongs in TrailCompass.
4. Document any new native plugin, permission, data source or licence requirement.

**Licence.** No licence has been chosen yet, so all rights are reserved by default. Add a `LICENSE` file before accepting outside contributions or calling the project open source.

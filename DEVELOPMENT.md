# Developing TrailCompass

How to build, run, test and release TrailCompass. For a file-by-file tour of the code and the reasons behind its design, read the [Project Guide](docs/PROJECT_GUIDE.md).

- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [npm scripts](#npm-scripts)
- [Project layout](#project-layout)
- [How it works](#how-it-works)
- [Theming the map](#theming-the-map)
- [Android builds](#android-builds)
- [Releasing a new version](#releasing-a-new-version)
- [The website on GitHub Pages](#the-website-on-github-pages)
- [Fuel and food data](#fuel-and-food-data)
- [Testing](#testing)
- [External services](#external-services)
- [Known issues and gotchas](#known-issues-and-gotchas)
- [Safety, licensing and contributing](#safety-licensing-and-contributing)

## Tech stack

| Area | Technology |
|---|---|
| UI | React 19, TypeScript 6, plain CSS (`src/index.css`, design tokens in `:root`) |
| Build | Vite 8 |
| Native shell | Capacitor 7, Android only (min Android 6.0, SDK 23; target SDK 35) |
| Capacitor plugins | Geolocation (permission only), Filesystem, Preferences, Share, App, Keep Awake, Text-to-Speech, and four plugins inside the app: `AppUpdaterPlugin`, `DownloadsPlugin`, `MapFilesPlugin` and `RideLocationPlugin` |
| Map | MapLibre GL JS 6 with OpenFreeMap's Liberty style (online) |
| Routing | On-device A* over OpenStreetMap roads downloaded from Overpass; Valhalla WASM optional |
| Tests and lint | Vitest 4 (Node environment), oxlint |
| Data builds | Python 3.10+ with DuckDB, reading Overture Maps from its public S3 bucket |
| Hosting | GitHub Releases (APKs) and GitHub Pages (website, data, APK copy) |

## Requirements

- **Node.js 20+** and npm 10.
- **For Android builds:** JDK 21 and the Android SDK (platform 35). Android Studio's default install works. The scripts find the SDK through `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and the JDK in its usual locations.
- **For data builds:** Python 3.10+ and `pip install duckdb==1.5.6`.
- **For releases:** the GitHub CLI, signed in (`gh auth login`).
- **A real Android phone.** GPS, compass, voice prompts, keep-awake and in-app updates can only be tested properly on a device.

## Quick start

```bash
git clone https://github.com/praneth2580/TrailCompass.git
cd TrailCompass
npm install        # "ERESOLVE overriding peer dependency" warnings are expected
npm run dev        # http://localhost:5173 (GPS needs localhost or https)
npm test
```

The web build is good for UI work. Anything native (GPS accuracy, sensors, file storage, voice, installs) needs `npm run cap:run` and a phone.

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server (also reachable from your LAN) |
| `npm run build` | Type-check (`tsc -b`) and build the web app into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |
| `npm test` | Vitest unit tests. `LIVE_OSM=1 npm test` also runs the `*.scratch.test.ts` tests that call live OSM servers (slow) |
| `npm run cap:sync` | Build, then copy the web app into the Android project |
| `npm run cap:build` | Sync, then assemble the debug APK |
| `npm run cap:emulator` | Start an emulator (`ANDROID_AVD`, or the default AVD) |
| `npm run cap:install` | Install the debug APK on a connected phone or emulator |
| `npm run cap:run` | Build, sync, assemble, install and launch |
| `npm run release:minor` / `release:major` | Publish a new version on GitHub with its APK ([details](#releasing-a-new-version)) |
| `npm run icons:generate` | Regenerate app icons and splash screens from the brand mark |
| `npm run data:poi` | Rebuild the bundled fuel and food data ([details](#fuel-and-food-data)) |
| `npm run site:build` | Assemble the website into `_site/` |
| `npm run site:preview` | Build the website and serve it locally (port 4173) |
| `npm run site:og` | Re-render the share image `site/og-image.png` |

## Project layout

```text
.github/workflows/pages.yml   Publishes the website, fuel and food data, and APK copy to GitHub Pages
android/                      Capacitor Android project (the app's own plugins live here)
docs/PROJECT_GUIDE.md         In-depth guide to the code
public/                       App icons and bundled assets
  assets/poi/                 Fuel and food tiles for India (Overture Maps), with sources and licences
resources/                    Master app icon
scripts/                      Android build/run, release, icons, data and website builders
site/                         The landing page: static HTML, CSS and a small script
src/
  app/                        App shell: wires services to screens; tab table
  components/                 Screens, sheets, banners, widgets
  services/                   Location, compass, map, navigation, trips, stops, voice, updates
  routing/                    Road downloads (Overpass), road graph and A*, turn instructions, route files
  database/                   Small JSON stores on Capacitor Preferences
  offline/                    Offline maps: PMTiles writer, tile store, tile planning, the map's tcmap:// protocol, file storage
  hooks/                      Back button, keep-awake, ride view
  theme/                      The map's colours: default theme, presets, env overrides
  types/                      Shared types
```

## How it works

**App shell and services.** State lives in singleton services (`src/services/*.service.ts`). Each has `getState()` and `subscribe()`, and there is no state library. `src/app/App.tsx` connects them to the screens. The map stays mounted behind the other tabs, so it doesn't reload when you switch.

**Routing.** Routes are calculated on the phone, never by an online routing API. For a long trip, the app first downloads the major roads (motorway, trunk and primary) in 0.5° tiles around the trip. It finds the main path on them, then downloads local streets along that path to refine each leg. The roads come from public Overpass servers through `src/routing/overpass-client.ts`, which handles retries, a server that never answers and server cooldowns. Downloaded areas are kept in memory and saved on the phone as "road packs", so planning again in the same area is quick. Valhalla WASM is used instead only if a tile archive is bundled; none is shipped.

**Bridges and flyovers.** A flyover leaves the road under it at a shallow angle, so turn angles alone never mention it. The road data keeps OSM's `bridge` and `tunnel` tags. At each fork on the route, `structure-guidance.ts` looks 300 m down every branch, and where one goes over a bridge or through a tunnel and the route's way doesn't (or the reverse), it adds "Keep right to take the flyover" or "Keep left to stay below Andheri Flyover", spoken like any turn. The banner adds a sign under it: a side-view picture of the fork with the route's road in bold, labelled "Take flyover", "Go below flyover", "Enter underpass" or "Skip underpass". The map gives bridges dark edges and a shadow, dashes tunnels, and marks the route's own bridges (rails and a name) and tunnels (a dashed stripe).

**Traffic signals.** OSM's traffic signals come with the road data, and the router counts an average wait at each (once per junction). The route keeps the signals it stops at (`CalculatedRoute.signals`): the map puts a traffic light at each, and while navigating the banner warns of the next one within 400 m ("Signal in 180 m", or "Signal at the turn" when it's at the next turn's junction). Only where the signal is mapped in OSM; there is no live signal timing.

**Navigation.** `navigation.service.ts` follows your position along the route. It detects when you're off route (it needs two bad fixes in a row) and reroutes, skipping stops you've already passed. Voice prompts (`voice-guidance.service.ts`) are timed to your speed. The screen stays on while you navigate, and the ride view goes full screen once you're moving.

**GPS modes.** On Android the position comes from `RideLocationPlugin` (`LocationHub.java`), in the mode picked under Offline → Location (`location.service.ts`): **Satellites only** (Android's GPS provider: no data, no Google services), **Satellites + mobile data & Wi-Fi** (GPS and network providers, the GPS preferred while it has a fix; the default) or **Battery saver** (network only, about 100 m). Permission is still asked through `@capacitor/geolocation`. In a browser, the browser picks the source; Battery saver asks it for less accuracy.

**Ride log.** `ride-log.service.ts` records rides: from the record button on the map, or by itself while navigating (a setting, on by default; arriving or stopping finishes it). On Android, `RideRecorderService` (a `location` foreground service, kept when the app is swiped away) appends every fix to `map-packages/rides/<id>.csv` and shows the distance and time in a notification with Pause and Finish; the app picks the ride up when reopened. In a browser the page records while open. Finishing turns the raw track into a ride (`ride-track.ts`: only fixes within 30 m, moves over the GPS's own wobble, pauses not bridged, moving time above 3.6 km/h, top speed as the middle of three readings, climb in 10 m steps, the track simplified to 3 m), kept by `database/ride-repository.ts`. Library → Rides lists them: show on the map, export GPX, save as a trip, delete with Undo.

**Offline maps.** Every map request goes through the `tcmap://` protocol (`src/offline/tile-protocol.ts`). The style is a bundled copy of OpenFreeMap's Liberty style (`src/offline/liberty-style.json`), so the map opens without a network. A vector tile comes from the phone's tile store when it has it, else from OpenFreeMap. Fonts and icons are kept on the phone the first time they load.

An offline map is either a trip (saving one, or ticking **Offline map** when sharing) or an area: a city, district or state searched in the Offline tab (**Save an area**, through Nominatim with the area's outline). `src/offline/tile-plan.ts` picks its tiles: for a trip, the whole area up to zoom 8, then narrower bands along the road up to zoom 14; for an area, every tile of its outline zoom by zoom, as close as fits. A map is only a list of tiles (`src/services/map-pack.service.ts`). The tiles themselves are kept once, in the tile store (`src/offline/tile-store.ts`): PMTiles files under `map-packages/tiles/`, each tile with the time it was downloaded and the OpenFreeMap build it came from. Maps that overlap share tiles, a download skips tiles already saved from the current build, and when a tile is saved again the newer download wins. Tiles no map needs are deleted, and a file that is mostly replaced tiles is rewritten.

Downloads stay within OpenFreeMap's offline limits: at most 3,000 tiles, 50 MB and 4 requests at a time, with the `TrailCompass` User-Agent (`capacitor.config.ts`). A long trip or a big area keeps less street detail: a state gets its main roads, a city its streets. On Android the files live in the app's data folder, and the map reads tiles by byte range through `MapFilesPlugin` (the web view's local server ignores where a Range starts). In a browser they are kept in IndexedDB.

**Sharing maps.** A trip or an area can be shared as one `.trailcompass.pmtiles` file: its tiles, each tile's download time, the map's details and, for a trip, the route. Importing one (Library or the Offline tab) merges it in as if it had been downloaded on that phone: a trip with the same id is kept once, whichever copy changed last; of each tile, the newer download wins; and the map's details come from whichever copy was downloaded last. Plain `.trailcompass.json` files still work, and also keep one copy per trip.

**Fuel and food on the map.** Fuel stations and restaurants are separate overlays, each switched on or off in the Offline tab's **Map** section. The layers button under "my location" shows or hides all overlays at once. Inside India they come from the bundled Overture data (`bundledPoisInBounds`); elsewhere they come from OpenStreetMap places in the map tiles, so they work offline in a saved map too. Tap one for its name, **Go here** or **Add stop**.

**Fuel and food stops.** `stop-suggest.service.ts` plans fuel stops by tank range and food stops by meal time. It searches a stretch of the route, not single points. Places come first from the Overture data bundled in `public/assets/poi/`, which also works offline. Live OpenStreetMap results are added where those are few: Nominatim for small areas, Overpass for long stretches.

**Planning in the background.** Whenever a route starts planning (with the app on screen), a foreground service (`DownloadService`, type `dataSync`) shows a persistent notification with its progress. **Run in background** sends the app away while it carries on. The planning itself keeps running in the web view; the service only stops Android from closing the app. The notification's Pause cancels the plan and keeps the roads downloaded so far; Resume plans the same trip again from that cache; Stop cancels it. When the plan finishes in the background, a second notification says the route is ready or why it failed. `background-planning.service.ts` drives this through `DownloadsPlugin`.

**Wi-Fi only downloads.** The Offline tab's Downloads setting (`download-policy.service.ts`) can keep large downloads off mobile data. Road downloads for planning and offline maps then wait for Wi-Fi (the progress line says so), and fuel and food data and app updates hold off. Rerouting during a ride, the map on screen and searches always use whatever network is up. `DownloadsPlugin` reports the network type from Android's `ConnectivityManager`.

**Updates without a new build.** The fuel and food data refreshes itself. About once a day, `poi-data.service.ts` checks the website's `poi/manifest.json` and downloads a newer release. The app updates itself too: `app-update.service.ts` checks the website's `download/latest.json`, falling back to the GitHub API. It downloads the APK with progress and opens Android's installer through `AppUpdaterPlugin`.

## Theming the map

Every colour the map draws with comes from one theme in `src/theme/map-theme-core.ts`. That covers the route and route options, recorded rides, traffic, fuel and food places, pins and the rider marker. A theme can also recolour the basemap. The default theme is the app as it has always looked: OpenFreeMap Liberty with the amber route.

A build picks its theme from env variables. Put them in `.env.local` (git-ignored; start from `.env.example`) or set them in the shell. Each row overrides the rows above it:

| Variable | Sets | Example |
|---|---|---|
| `VITE_MAP_THEME` | A preset: `default` or `dark` | `VITE_MAP_THEME=dark` |
| `VITE_MAP_THEME_JSON` | Any part of a theme, as JSON | `VITE_MAP_THEME_JSON='{"route":{"active":"#e63946"}}'` |
| `VITE_MAP_COLOR_<GROUP>_<NAME>` | One colour | `VITE_MAP_COLOR_ROUTE_ACTIVE="#e63946"` |

```bash
VITE_MAP_THEME=dark npm run dev
VITE_MAP_THEME=dark npm run cap:run     # an APK with the dark map
```

- **Colours** are anything MapLibre reads: hex (`#e63946`, `#e6394680`), `rgb()`, `rgba()`, `hsl()`, `hsla()` or a CSS colour name.
- **Quote colours in `.env` files.** An unquoted `#` starts a comment, so `VITE_MAP_COLOR_ROUTE_ACTIVE=#e63946` is read as empty. Put JSON in single quotes for the same reason.
- **The theme is fixed when the app is built**, because Vite inlines `import.meta.env`. Rebuild the APK after changing it. The dev server restarts by itself when a `.env` file changes.
- **Mistakes are reported, not guessed at.** A value that isn't a colour, a name that isn't in the theme, or a preset that doesn't exist fails `npm run build`, so an APK never ships with a colour quietly skipped. The dev server and the browser console only warn, and the colour underneath stays.

### Colours

Each colour's variable is `VITE_MAP_COLOR_`, then the group and name in capitals with words split by `_`. For example, `route.recalcLink` is `VITE_MAP_COLOR_ROUTE_RECALC_LINK`.

| Colour | Default | Used for |
|---|---|---|
| `route.active` | `#F5A623` | The route on offer or being followed |
| `route.passed` | `#8b939c` | The part of it already ridden |
| `route.recalculating` | `#c47d10` | The route, dashed, while a new one is worked out |
| `route.previous` | `#8fa698` | The route before a reroute, until the new one arrives |
| `route.recalcLink` | `#ff6b4a` | The dashed line from the rider to the destination while rerouting |
| `route.alternatives` | `#5b8def, #9b7bff, #3dbea5` | Route options in turn, and their button swatches. A JSON array, or comma-separated in the variable |
| `ride.recording` | `#ff5a5f` | The ride being recorded |
| `ride.past` | `#b28dff` | A past ride opened from the ride log |
| `traffic.clear`, `.moderate`, `.slow`, `.jammed` | `#0ca30c`, `#fab219`, `#ec835a`, `#d03b3b` | A route by its usual traffic, on the map and in its legends |
| `traffic.none` | `#8b939c` | Stretches without enough rides to tell |
| `traffic.casing` | `#1d1d1d` | The outline under the traffic line |
| `places.fuel`, `places.food` | `#3dbea5`, `#e07a5f` | Fuel and food icons, and fuel and food stop pins |
| `places.icon` | `#ffffff` | The pump or cutlery on an icon |
| `places.label`, `places.labelHalo` | `#3b3b3b`, `#ffffff` | Place names |
| `markers.rider`, `markers.riderOutline` | `#3b8ef0`, `#ffffff` | The GPS dot and the navigation arrow |
| `markers.destination` | `#f0a020` | The destination pin |
| `markers.stop` | `#7b8cff` | A stop dropped on the map |
| `markers.outline` | `#1a1205` | The edge of pins and icons, and the disc in a pin |
| `markers.glyph` | `#f5f0e6` | The dot or letter in a pin's disc |
| `structures.bridgeCasing` | `#73655a` | The edges of bridges and flyovers on the basemap, so they stand out from the road below |
| `structures.bridgeShadow` | `rgba(40, 30, 20, 0.3)` | The soft shadow under a bridge |
| `structures.routeBridge` | `#1a1205` | The rails along the route where it goes over a bridge |
| `structures.routeTunnel` | `#ffffff` | The dashed stripe down the route through a tunnel or underpass |
| `structures.label`, `structures.labelHalo` | `#3b2a0e`, `#ffffff` | Bridge and tunnel names along the route ("Andheri Flyover") |
| `signals.housing`, `signals.outline` | `#1d1d1d`, `#ffffff` | The traffic light at each signal on the route, and in the banner's "signal ahead" warning |
| `signals.red`, `signals.amber`, `signals.green` | `#ff4d4f`, `#ffb020`, `#2fcf6f` | Its three lamps |

**Basemap colours** are unset by default, so Liberty shows as it comes. Each one covers a family of Liberty's layers (`BASEMAP_TARGETS`) and only replaces colours those layers already have. One colour replaces Liberty's zoom-dependent shading for that family. For anything finer, such as one layer, line widths or opacity, edit `src/offline/liberty-style.json`.

| Colour | Liberty layers |
|---|---|
| `basemap.background` | Land |
| `basemap.landuse` | Residential areas, sports grounds, cemeteries, hospitals, schools, sand, ice, airports |
| `basemap.park` | Parks, woods, grass |
| `basemap.water` | Sea, lakes, rivers |
| `basemap.building` | Buildings, flat and 3D |
| `basemap.motorway` | Motorways and their links |
| `basemap.majorRoad` | Trunk, primary, secondary and tertiary roads, and links |
| `basemap.minorRoad` | Streets, service roads, tracks, runways |
| `basemap.roadCasing` | Road edges |
| `basemap.path` | Footpaths |
| `basemap.rail` | Railways |
| `basemap.boundary` | Borders |
| `basemap.label` | Names of places, POIs, roads and airports |
| `basemap.waterLabel` | Names of seas and rivers |
| `basemap.labelHalo` | The halo around names |

### Adding a preset

Add an entry to `MAP_THEME_PRESETS` in `src/theme/map-theme-core.ts`. A preset is laid over the default theme, so it only lists what it changes. `npm test` checks that every preset resolves cleanly.

### Colours in code

Read colours from `mapTheme` (`src/theme/map-theme.ts`), never a literal. `map.service.ts` draws with it, `buildMapStyle()` applies `basemap` to Liberty, and the UI uses it wherever it repeats a map colour (route option swatches, the traffic legend). For CSS, `src/main.tsx` sets the colours the stylesheet needs as `--tc-map-*` variables on `:root`: the rider dot (`.tc-position-marker`), the Plan tab's stop icons (`.tc-plan-icon`) and the banner's signal warning (`.tc-nav-signal`) read them.

The app's own interface colours are separate: they are the design tokens in `:root` of `src/index.css`.

## Android builds

```bash
npm run cap:run          # build, sync, assemble, install and launch the debug APK
```

Or one step at a time: `npm run cap:sync`, `npm run cap:build`, `npm run cap:install`. To work in Android Studio, run `npx cap open android`. If no phone is connected, `cap:install` and `cap:run` start an emulator; set `ANDROID_AVD` to choose which one.

- **Native code** in `android/app/src/main/java/com/praneth2580/trailcompass/`, registered in `MainActivity`:
  - `AppUpdaterPlugin.java` downloads update APKs and opens the installer.
  - `DownloadsPlugin.java` starts and stops `DownloadService` (background planning), posts its notifications (`DownloadNotifications.java`), and reports Wi-Fi or mobile data.
  - `MapFilesPlugin.java` reads and writes byte ranges of offline map files (PMTiles) in the app's data and cache folders.
  - `RideLocationPlugin.java` gives the app its position from the chosen GPS mode (`LocationHub.java`) and controls ride recording (`RideRecorderService.java`).
- **Permissions:** location and internet; `REQUEST_INSTALL_PACKAGES` for in-app updates; `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC` and `POST_NOTIFICATIONS` (asked the first time you run planning in the background) for background planning; `FOREGROUND_SERVICE_LOCATION` for recording rides with the screen off; `ACCESS_NETWORK_STATE` for the Wi-Fi only setting.
- **App ID.** `com.praneth2580.trailcompass`. Changing it makes Android treat the app as a different one, so installed copies won't update to it.

## Releasing a new version

```bash
npm run release:minor -- --notes "What changed"   # or release:major; add --draft to review first
```

The script needs a clean working tree and a remote named `origin`. On a fresh clone, run `npm run cap:sync` once first: the script also updates Android's generated `config.xml`, which only exists after a sync. It then:

1. Bumps the version in `package.json` and the Android `versionName` and `versionCode`.
2. Builds the debug APK.
3. Commits, tags `vX.Y.0` and pushes.
4. Creates the GitHub release "TrailCompass vX.Y.0" with `trailcompass.X.Y.0.apk` attached.

Publishing the release starts the Pages workflow, which copies the APK onto the website. From then on, the website's download button and the in-app updater offer the new version. Your `--notes` become "What's new" in the app's update sheet.

**Keep the signing key.** Releases are debug builds signed with the debug key of the machine that built them. Android only installs an update signed with the same key as the installed app. Build every release on the same machine, or set up a release keystore before you switch.

## The website on GitHub Pages

The site at <https://praneth2580.github.io/TrailCompass/> is published by `.github/workflows/pages.yml` ("Publish site"). Pages replaces the whole site on every publish, so one workflow always publishes everything together:

| Path | Contents |
|---|---|
| `/` | The landing page, built from `site/` by `scripts/build-site.mjs` |
| `download/latest.json`, `download/*.apk` | A copy of the newest release. GitHub's own release downloads are slow or stall on many mobile networks; Pages is served through a CDN |
| `poi/manifest.json`, `poi/<release>/…` | The fuel and food data the app downloads |

The workflow runs:
- **Every Monday:** rebuilds the data when Overture has a new release.
- **On a push to `main` that changes the website:** republishes it, copying over the data that's already live.
- **When a release is published:** republishes so the site serves the new APK.
- **From Actions → Publish site → Run workflow:** tick "force" to rebuild the data too.

If any live data file fails to copy, the run stops before publishing, so a publish never drops data.

One-time setup: in the repository, go to Settings → Pages → Build and deployment and set Source to **GitHub Actions**.

To work on the website locally, run `npm run site:preview`. After changing the phone illustration in `site/index.html`, run `npm run site:og`. It needs Playwright's Chromium (`npx playwright install chromium`), or `CHROME_PATH` pointing at an installed Chrome.

## Fuel and food data

The app bundles about 55,000 fuel stations and 138,000 places to eat in India, taken from the [Overture Maps](https://overturemaps.org) places theme. They're stored in 1° tiles under `public/assets/poi/`.

```bash
python3 -m pip install duckdb==1.5.6
npm run data:poi                                   # India; about 10 minutes
python3 scripts/build-poi-tiles.py --country IN --country NP   # add countries
```

- **Selection:** places must lie inside Overture's boundary for the chosen countries, including territorial waters. Low-confidence and closed places are dropped.
- **Safety check:** the script refuses to replace the data if a kind loses more than 20% of its places (`--allow-drop` overrides). Such a drop is more likely a broken scan than real closures.
- **Other options:** `--release`, `--out` and `--previous`. The Pages workflow uses them to publish data updates without touching the bundled copy.
- **Sources and licences** (CDLA Permissive 2.0, CC0 and Apache 2.0, by provider): [`public/assets/poi/README.md`](public/assets/poi/README.md).

## Testing

- **Unit tests:** `npm test`. They cover routing, geometry, off-route detection, the Overpass client, stop suggestions, data and app updates, voice prompts and more. Tests sit next to the code as `*.test.ts`.
- **Live tests:** `LIVE_OSM=1 npm test` also runs `src/routing/e2e-goregaon.scratch.test.ts`. It plans a real route on live servers and can take many minutes.
- **Before a release:** run `npm run lint`, `npm run build` and `npm test`.
- **On a phone, check:**
  - GPS lock and accuracy.
  - Voice prompts through a headset.
  - The screen staying on while navigating.
  - The back button closing sheets.
  - Fuel and food suggestions in airplane mode.
  - An in-app update from the previous version.

## External services

| Service | Used for | Notes |
|---|---|---|
| [OpenFreeMap](https://openfreemap.org) | Map tiles, fonts and icons; offline maps | No API key. Offline downloads: at most 3,000 tiles or 50 MB each, 4 requests at a time, identifying User-Agent |
| [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) | Road data, live fuel and food top-up | Public servers that are often busy. The client also tries `lz4.` and `z.overpass-api.de` and skips servers that just failed |
| [Nominatim](https://nominatim.org) | Place search; fuel and food lookups in small areas | At most 1 request per second; on Android the app sends an identifying User-Agent |
| [Overture Maps](https://overturemaps.org) | Fuel and food data, at build time | Public S3 bucket, read with DuckDB |
| GitHub Pages | Website, data updates, APK copy | Served through a CDN |
| GitHub Releases and API | APKs, update-check fallback | The unauthenticated API allows 60 requests an hour per IP |

## Known issues and gotchas

- **Adding an npm package needs `--legacy-peer-deps`.** `@jansoft/mbujkanji-valhalla-wasm` depends on `@vitest/browser-*@latest`, which conflicts with the project's Vitest. A plain `npm install` from the lockfile only warns.
- **Only saved trips and areas have an offline map.** Elsewhere the map needs a network. Zoomed in past a saved map's detail, MapLibre stretches the closest zoom it has. Offline, the map keeps the fonts and icons it has loaded before: Latin, Indian scripts and Urdu are saved with the first offline map.
- **Offline map downloads stop if the app is closed.** They run in the web view, like route planning. Tiles already downloaded are kept (in files of up to 500 tiles), so **Resume** carries on from there.
- **Maps saved by builds from before the tile store are dropped.** Save a trip's map again from Library.
- **Overpass can be down.** When every public Overpass server is busy, planning a long trip fails. Areas that did load are kept, so trying again later carries on.
- **Swiping the app away ends background planning.** The planning runs in the web view, which closes with the app, so the service stops too (`android:stopWithTask`). Areas already downloaded stay cached.
- **Placeholder app ID and debug builds** (see [Android builds](#android-builds) and [Releasing](#releasing-a-new-version)).
- **More open issues**, with links to the code: [Project Guide §19](docs/PROJECT_GUIDE.md#19-known-issues-and-gaps).

## Safety, licensing and contributing

**Safety.** TrailCompass is not a certified navigation or safety system, and the app and website both say so. Don't add features that encourage using the phone while riding.

**Map data and attribution.** OpenStreetMap data is under the ODbL. Show attribution for every source: OpenStreetMap contributors, OpenFreeMap, the Overture Maps Foundation and its providers. Don't bulk-download tiles from the public OpenStreetMap tile servers: their policy forbids it. For any new data source, check that its licence allows bundling and redistribution, and record it next to the data.

**Contributing.** Before proposing a change:

1. Describe the behaviour or bug.
2. Run `npm run lint`, `npm run build` and `npm test`, and test on Android where it matters.
3. Include steps to reproduce device-specific issues.
4. Document any new native plugin, permission, data source or licence requirement.

**Licence.** No licence has been chosen yet, so all rights are reserved by default. Add a `LICENSE` file before accepting outside contributions or calling the project open source.

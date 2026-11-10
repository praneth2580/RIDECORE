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
| Its docs and website | `README.md`, `DEVELOPMENT.md`, `docs/PROJECT_GUIDE.md`, `site/`: TrailCompass's once, now RIDECORE's, kept on merges by `.gitattributes` ([below](#docs-and-the-website)) |

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

RIDECORE is the phone's home screen, worked like a watch: screens to swipe through in
both directions instead of buttons (`src/ridecore/app/App.tsx`, two `components/Pager.tsx`).
Each snaps into place; dots along the bottom say which screen, dots down the right edge
where you are in the dash's column. A status line (time, GPS, battery, recording) sits
over all of them.

The screens are a device's, not a phone app's: each one's name small and centred at the
top (`components/Page.tsx`), big glove-sized targets, few words. Settings are keys
(`components/Key.tsx`: an icon, a word and its state, lit lime when on) instead of rows
of switches with explanations; actions are round keys with a word under them; trips and
rides are cards showing their shape. Grids fill the screen either way up: two keys across
in portrait, four or more in landscape, where keys put the icon beside the word.

The screens sit round the dash like a plus, each where a rider would reach for it, so
everything is a swipe away (Rides two): music to the left; where to, ahead, to the right,
with rides beyond it; settings pulled down from above and the apps pulled up from below,
as on Android. Left and right, from the dash:

0. Music, left of the dash, a swipe right away (`screens/MusicPage.tsx`): what plays, from any of
   the phone's music apps or RIDECORE's own radio, with big keys to play, pause, go back
   and skip. Then radio: favourite stations as keys (star a station; hold its key to
   unstar it), then the country's most played stations. One plays at a time: starting the
   radio pauses the phone's music and the other way round (`src/ridecore/media.ts`).
1. The dash: the speed dial, the live map with the next turn over it, and the trip.
   No buttons but "Where to?" when idle. The map has no box: it runs the full width of
   the screen and fades into the black at its edges (in landscape it runs behind the two
   dials, fading out under them). It's a display that always follows the rider and zooms
   with speed; swipes go through it, and a tap gives it the whole screen to look around
   (one close chip). "Arrived" is tapped to finish. The phone's state sits in the room the
   round dials leave in the corners (`components/StatusCorners.tsx`): signal bars with a
   SIM (or Wi-Fi, airplane mode, "Offline"), GPS, a connected headset, the battery; a
   word only when something's wrong. Away from the dash the top line carries them, as
   icons. Settings → On the dash and Status switch each part on or off (speed, map, trip,
   Where to, music, weather; clock, heading, weather, network, GPS, headset, battery;
   `src/ridecore/dash.ts`); what's off gives its room
   to the rest. With the map
   off the next turn still shows, under the speed. The readout under the map (the right
   dial in landscape, `components/TripReadout.tsx`) has faces, tapped through with dots
   to show which: the trip and the ride while there's one, what plays while there's
   something, the weather, the time (`src/ridecore/faces.ts`). The one tapped to stays,
   across restarts; something starting shows itself (a trip always, a ride or music
   unless a trip is under way), and a face that goes hands over to the first there is,
   in that order. What plays shows its cover (the whole dial in landscape, darkened
   under the words), song and artist, bars moving while it plays, and keys for back,
   play or pause, and next; those keys work the music instead of turning the face. A
   small dial (most phones in landscape) drops Back, which the Music screen still has,
   and the smallest also the artist.
2. Where to (`screens/GoPage.tsx`): typing on a mounted phone is slow, so places picked
   before (from search or these keys) come first, one tap to go again (`src/ridecore/recent.ts`, the last
   6; hold one to forget it), then saved trips as cards, then search (the keyboard's
   search key). A tap in the search field holds this screen until the search is closed
   (×, Back, picking a place, or 30 s alone): the field stays put and the results scroll
   inside. While a trip is under way this is the trip instead (`screens/TripPage.tsx`):
   time to go, distance left and arrival as big as the dash's numbers, two round keys
   (voice; End, two taps, no dialog) and the next 8 turns, beside them in landscape.
3. Rides (`screens/RidesPage.tsx`), beyond Where to: the recorder's big face
   (`components/Recorder.tsx`) with the distance, time and average speed; tap to record,
   pause and carry on. Only once paused do Save and Discard (two taps) appear, so a
   gloved tap can't end a ride. Under it, every ride recorded, as cards with its shape
   and name, the total in the heading; tap one to see it on the map.

Up and down, on the dash only, as on a phone's home screen: swipe down for settings,
swipe up for the apps the rider picked, and up again for all the phone's apps. Apps
(`screens/AppsPage.tsx`) holds up to `PICKS_MAX` (8) as big keys in a fixed grid, two
across in portrait and four in landscape, so a key never moves as others come and go;
an "All apps" key fills the next slot while there's room. All apps
(`screens/AllAppsPage.tsx`) is the drawer, A to Z, with the picked ones marked lime. Tap
an app to open it; hold one, in either screen, to put it on Apps or take it off. The
picks are kept in picked order (`apps.ts`, under the old pinned-apps key, so earlier pins
became the first picks). The way back is the way in: each has a handle on its edge toward
the dash (`Page`'s `handle`: Dash, or Apps from All apps), outside its list, to swipe or
tap however far down the list is, and sideways does nothing there (the outer pager is
held on the dash).

As a launcher: Home always brings the dash back (a route being chosen stays chosen),
Back closes what's open and then goes back to the dash, and nothing is behind it. Left
on another screen for 30 s, or with a turn coming up or arriving, the dash comes back
on its own.

Choosing a route is done stopped, so from planning until Start the map takes the whole
screen with the route panel over it (`components/RoutePanel.tsx`): the routes on offer
and Start, a × to cancel, and a scroll further down the route type (Fastest / Shortest /
Less traffic) and expressways. The grey line says which are in use. Changing one plans
again, and both are kept for the next trip.

Turns are also seen without reading them: as one comes up, the screen's edge on its
side glows lime over whatever screen shows (`src/ridecore/glow.ts`,
`components/TurnGlowEdges.tsx`). It starts about 12 seconds out at the rider's speed,
brightens to the turn and pulses at it; a U-turn lights the right edge (left-hand
traffic), arriving lights both green. Settings → Riding → Turn glow switches it off.

Music, radio and weather:

- **The phone's music.** `RideCoreMedia` (Java) follows the phone's media sessions: the
  title, artist, app and cover of what plays, and its controls. Seeing what plays needs
  notification access, which Android only lets the rider give: the Music screen and
  Settings → Music info open the screen for it (`RideCoreMediaListener` is the listener
  that access is given to; it does nothing itself). Without it play, pause and skip still
  work, sent as a headset's media buttons are.
- **Radio** (`src/ridecore/radio.ts`): stations from Radio Browser
  (radio-browser.info, an open directory, no key), the country's most played, played in
  RIDECORE's own audio element. Only HTTPS streams: the app is served over HTTPS
  (`androidScheme`) and mixed content is off. A station silent after 15 s has failed.
- **Weather** (`src/ridecore/weather.ts`): Open-Meteo (free, no key), every 15 minutes
  and on riding into the next ~5 km square; the position sent is rounded to that square.
  The temperature shows in the top line, with an umbrella and the chance when rain is
  40% likely or more in the next three hours.

The map zooms with speed, out when fast and in when slow: on the dash, and on any screen
while navigating. Settings → Speed zoom multiplies how far it zooms out, tapped through ×0.5,
×1 and ×1.5 (×1 is TrailCompass's own curve). The multiplier lives in the
`services/nav-display.ts` override, and `engine.ts` keeps the choice. TrailCompass zooms
by speed only while navigating; `mapService.setFollowZoomBySpeed()` (below) lets the
dash's camera do it while just riding too. TrailCompass's fuel and food pins start
switched off (Settings switches them on), so the map stays clean. Landscape lays the
speed, road and trip side by side; portrait stacks them.

## The phone it runs on

RIDECORE is made for a phone kept for it alone, as that phone's home screen.

- **Layout.** The first start asks how the phone is mounted, landscape or portrait;
  Settings → Mounted changes it. `RideCoreDevicePlugin` (Java) keeps the choice and holds
  the screen that way, either way up, from the moment the app starts.
- **Home screen.** RIDECORE can be Android's home app: Settings → Home app,
  then pick RIDECORE. Home and switching the phone on then open it, Home pressed in
  RIDECORE goes back to the dash, and Back stops at the dashboard.
- **The phone's apps.** Swiping up from the dash shows the ones picked for riding, and
  again the app drawer with them all; tap one to open it, hold one to pick it or drop it
  (up to 8). `RideCoreDevicePlugin` lists
  them (`listApps`, icons as PNG data URLs), opens them (`openApp`), and tells the web
  side when Home is pressed (the `home` event). In a browser there are none to list.
- **Signal and headset.** `RideCoreDevicePlugin` reports the SIM, its signal bars, Wi-Fi
  or offline, airplane mode and a connected headset (`getStatus`, the `status` event;
  `RideCoreStatus.java`). It needs no permission, so the network type (4G, 5G) isn't
  shown: that would take the "make and manage phone calls" permission.
- **Full screen.** `RideCoreDevicePlugin` hides Android's status and navigation bars (a
  swipe in from an edge shows them for a moment); RIDECORE's status line has the time,
  signal and battery. From Android 15 the page runs under the camera's cut-out, so the
  plugin reports its size (`getCutout`, the `cutout` event) and `cutout.ts` keeps the
  page's edges clear of it.
- **Screen on.** On all the time unless Settings → Screen on is set to Navigating.
- **The way out.** Settings → Phone settings opens the phone's own settings (Wi-Fi,
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

- `services/nav-display.ts`: wraps TrailCompass's and pulls the zoom by speed back
  1.3 levels (`ZOOM_OUT`), since RIDECORE's map is under half the screen TrailCompass
  zooms for, and scales how far it zooms out by the rider's multiplier
  (`setZoomMultiplier`), never further out than zoom 11. Everything else in the file is
  TrailCompass's, re-exported. Test: `src/ridecore/nav-zoom.test.ts`.
- `theme/map-theme.ts`: TrailCompass's, resolving RIDECORE's map colours (below) under
  the build's env instead of TrailCompass's defaults.

## Map colours

TrailCompass's map theme (`src/theme/`, `.env.example`, and "Theming the map" in
TrailCompass's DEVELOPMENT.md: `git show upstream/main:DEVELOPMENT.md`) colours the
basemap, routes and markers. RIDECORE's colours are
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

# TrailCompass's changes to its docs and site, which the merge kept out (below): carry
# over by hand anything RIDECORE needs, e.g. a new engine gotcha or setup step.
git log --oneline -p ORIG_HEAD..HEAD^2 -- README.md DEVELOPMENT.md docs site scripts/render-og-image.mjs

npm test && npm run build
git push
```

## Docs and the website

`README.md`, `DEVELOPMENT.md`, `docs/PROJECT_GUIDE.md`, `site/` (the website) and
`scripts/render-og-image.mjs` began as TrailCompass's and are now RIDECORE's own. Editing
them in place would conflict on every merge, so `.gitattributes` marks them `merge=ours`:
a merge keeps RIDECORE's version and drops TrailCompass's changes to them (listed by the
`git log` above). That needs the driver, once per clone:

```bash
git config merge.ours.driver true
```

Without it these files merge line by line and conflict. TrailCompass's own docs stay
readable for the engine: `git show upstream/main:DEVELOPMENT.md` and
`git show upstream/main:docs/PROJECT_GUIDE.md`, or on GitHub.

The website is <https://praneth2580.github.io/RIDECORE/>, published by TrailCompass's
`pages.yml` with RIDECORE's site and newest `ridecore-v*` APK. DEVELOPMENT.md → "The
website on GitHub Pages" covers how.

## Releasing

RIDECORE's releases are GitHub releases on praneth2580/RIDECORE, tagged
`ridecore-v<version>` so they never clash with TrailCompass's `v<version>` tags. The
alphas were pre-releases; from 1.0.0 they're full releases (an alpha or beta still goes
out with `--prerelease`). The first five lines of the notes show in the app's update
prompt, so lead with what riders will notice.
TrailCompass's `npm run release:*` is not for RIDECORE: it bumps TrailCompass's version
lines and titles the release "TrailCompass". The APK's version name comes from
`ridecore/version.gradle`, leaving `build.gradle` alone:

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug --init-script ../ridecore/version.gradle -Pridecore.versionName=1.0.1
cp app/build/outputs/apk/debug/app-debug.apk ridecore-1.0.1.apk
git tag ridecore-v1.0.1 && git push origin main ridecore-v1.0.1
gh release create ridecore-v1.0.1 ridecore-1.0.1.apk --title "RIDECORE 1.0.1" --notes-file notes.md
```

APKs are debug-signed with this machine's debug key, as TrailCompass's are. A phone
only installs a newer APK over an older one signed with the same key, so build every
release on the same machine, or set up a release key.

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
  RIDECORE can be the home screen; a `<queries>` entry for launcher activities, so it
  can list the phone's apps (Android 11 and later hide them otherwise); and the
  `RideCoreMediaListener` service, so the rider can give RIDECORE notification access to
  see what the phone plays. TrailCompass's launcher filter is untouched.
- `src/services/ride-log.service.ts`: a fix, worth sending upstream. `discard()` finished
  the recorder, the recorder said "finished", and that was taken for a ride finished from
  the notification, so a discarded ride was saved anyway (TrailCompass's own Discard too).
  `discard()` now marks the ride (`discarding`) and `onRecorder` leaves it alone.
- `src/services/map.service.ts`: `setFollowZoomBySpeed()`, so the camera following the
  rider zooms by speed without navigating too (the dash). Off unless called, so
  TrailCompass behaves as before; a candidate to send upstream. Three small spots: the
  flag and its setter, `cameraTarget()`'s dot branch, and `stepNavZoom()` taking the
  zoom to start from.
- Name "RIDECORE": `app_name` and `title_activity_main` in
  `android/app/src/main/res/values/strings.xml` (the name under the app icon), and
  `appName` and `appendUserAgent` in `capacitor.config.ts` (how the app names itself to
  OpenFreeMap).
- `android/app/src/main/res/values/styles.xml`: one item on the launch theme,
  `windowSplashScreenBackground` black, so Android 12 and later (which draw the splash
  themselves, the launcher icon in the middle) don't show it on white in light mode.
- `scripts/build-site.mjs`: `SITE_URL`, RIDECORE's site address for the sitemap.
- `.github/workflows/pages.yml`, step "Add the newest app release": it looks up the
  newest `ridecore-v*` release, pre-releases included (GitHub's "latest release" skips
  them), accepts its tag, and drops `ridecore-v` for `version` in `latest.json`.
- Replaced outright, and kept by `.gitattributes` so they don't conflict:
  `README.md`, `DEVELOPMENT.md`, `docs/PROJECT_GUIDE.md`, `site/`,
  `scripts/render-og-image.mjs` ([Docs and the website](#docs-and-the-website)); and the
  icons: Android's launcher icons (`res/mipmap-*/*.png`), its splash
  (`res/drawable*/splash.png`), `res/values/ic_launcher_background.xml` (black), and
  `public/`'s favicon and app icons. `node ridecore/icons.mjs` draws them all, and the
  website's, from one source: the lime dial. Never TrailCompass's `npm run
  icons:generate`, which paints its compass back over them.

To check for others:

```bash
git diff --stat upstream/main -- . ':!ridecore' ':!src/ridecore' ':!.gitattributes' \
  ':!README.md' ':!DEVELOPMENT.md' ':!docs' ':!site' ':!scripts/render-og-image.mjs' \
  ':!android/app/src/main/res/mipmap-*' ':!android/app/src/main/res/drawable*/splash.png' \
  ':!android/app/src/main/res/values/ic_launcher_background.xml' ':!public/favicon*' \
  ':!public/apple-touch-icon.png' ':!public/icon-*.png'
```

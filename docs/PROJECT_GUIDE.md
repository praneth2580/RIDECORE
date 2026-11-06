# RIDECORE — Project Guide

This guide explains how RIDECORE's code works, one file at a time: what each part does, how the screens fit together, and how RIDECORE drives its engine. Read it before changing a screen, the way screens are swiped, or anything that touches the phone itself.

It describes the working tree as of **2026-11-06**.

> [README.md](../README.md) introduces RIDECORE to riders. [DEVELOPMENT.md](../DEVELOPMENT.md) covers setup, scripts, builds, releases and the website. [ridecore/README.md](../ridecore/README.md) sets the rules for building on TrailCompass: where code goes, overrides, the name, merging and releasing. This guide is the in-depth reference. Where they disagree, this guide follows the code.
>
> **The engine has its own guide.** Routing, navigation, offline maps, GPS, ride recording and storage are TrailCompass's, and its Project Guide covers them: [on GitHub](https://github.com/praneth2580/TrailCompass/blob/main/docs/PROJECT_GUIDE.md), or locally with `git fetch upstream && git show upstream/main:docs/PROJECT_GUIDE.md`. This guide only covers what RIDECORE does with them.

---

## Contents

1. [What RIDECORE is](#1-what-ridecore-is)
2. [Tech stack](#2-tech-stack)
3. [Repository map](#3-repository-map)
4. [Architecture](#4-architecture)
5. [The shell (`app/App.tsx`)](#5-the-shell)
6. [A trip, end to end](#6-a-trip-end-to-end)
7. [Screens (`screens/`)](#7-screens)
8. [Components (`components/`)](#8-components)
9. [Small modules](#9-small-modules)
10. [Android and the build hook](#10-android-and-the-build-hook)
11. [Overrides and zoom by speed](#11-overrides-and-zoom-by-speed)
12. [Storage](#12-storage)
13. [Styling (`styles/ridecore.css`)](#13-styling)
14. [Tests](#14-tests)
15. [Known gaps](#15-known-gaps)
16. [Cheat sheet](#16-cheat-sheet)

Paths below are under `src/ridecore/` unless they say otherwise.

---

## 1. What RIDECORE is

RIDECORE is the home screen of an Android phone kept for riding and mounted on the bike. It works like a dedicated navigation device or a smartwatch, not like a phone app:

- **Screens, not buttons.** Full-screen pages are swiped through in both directions and snap into place, with dots to say where you are. The dash (speed, the map with the next turn, the trip) is home. There are no tab bars and no sheets.
- **What's on the screen is what you tap.** The recorder's face, a recent place, a trip card, an app icon. Ending a trip takes a second tap instead of a dialog.
- **It goes back to the dash on its own:** when Home is pressed, after 30 seconds left on another screen, when a turn is near, and on arrival.
- **It's a launcher.** It can be Android's home app, lists the phone's other apps to open them, and Back never leaves it.
- **Music on the ride.** One swipe from the dash: whatever the phone's music apps play, with big keys to control it, and internet radio played by RIDECORE itself. The weather where the rider is can show on the dash and in the top line.
- **One way up.** The first start asks whether the phone is mounted in landscape or portrait, and the screen is held that way. Every screen works in both.

**TrailCompass is the engine.** RIDECORE has its own screens and look, but routing, turn-by-turn, voice prompts, the map, offline maps, GPS, ride recording, storage and the Android plugins behind them are TrailCompass's. TrailCompass is the `upstream` remote, merged in regularly. RIDECORE adds files instead of editing TrailCompass's, so merges stay clean ([ridecore/README.md](../ridecore/README.md)).

---

## 2. Tech stack

The same as TrailCompass's, plus one Vite plugin:

| Layer | Technology | Notes |
|---|---|---|
| UI | React 19, TypeScript 6 | Function components and hooks. No state library: state comes from the engine's services. |
| Build | Vite 8 | `ridecore/vite-plugin.ts` swaps the entry, applies overrides and puts in RIDECORE's name (§10). |
| Native shell | Capacitor 7, Android only | Min Android 6.0 (SDK 23), target SDK 35. App ID `com.praneth2580.ridecore`. |
| Map | MapLibre GL JS 6 | Through TrailCompass's `MapView` and `mapService`, in RIDECORE's dark colours. |
| Native code | Java | `RideCoreDevicePlugin` and `RideCoreMedia` (§10), beside TrailCompass's plugins. |
| Online services RIDECORE adds | [Radio Browser](https://www.radio-browser.info), [Open-Meteo](https://open-meteo.com) | Radio stations and the weather. Both free, no key, no account (§9). |
| Tests and lint | Vitest 4, oxlint | RIDECORE's tests sit next to its code (§14). |
| Font | Lexend, from Google Fonts | Falls back to the system sans without a connection. |

---

## 3. Repository map

RIDECORE's own files:

```text
ridecore/                       Build tooling and the rules
  README.md                     Building on TrailCompass: where code goes, merging, releasing
  vite-plugin.ts (+ .test.ts)   Entry swap, overrides, the name (§10)
  version.gradle                The APK's version name, leaving build.gradle alone
src/ridecore/                   The app
  main.tsx                      Entry: index.html starts this instead of src/main.tsx
  engine.ts                     The one door into TrailCompass (§4)
  app/                          App.tsx (the shell), useRideCore.ts (starts the engine), useBattery.ts
  screens/                      One file per screen (§7)
  components/                   Pager, Page, Key, MapZone, RoutePanel, the dials… (§8)
  dash.ts recent.ts turns.ts    Small modules with their tests (§9)
  media.ts radio.ts weather.ts glow.ts status.ts
  format.ts device.ts map-theme.ts
  overrides/                    TrailCompass modules RIDECORE replaces (§11)
  styles/ridecore.css           The whole look (§13)
android/app/src/main/java/com/praneth2580/ridecore/
  RideCoreDevicePlugin.java     Layout lock, home screen, the phone's apps, music (§10)
  RideCoreMedia.java            Follows and controls what the phone's music apps play
  RideCoreStatus.java           SIM and signal, Wi-Fi or offline, airplane mode, a headset
  RideCoreMediaListener.java    The notification listener that access to see what plays is given to
```

TrailCompass's files, used but not edited (apart from the short list in [ridecore/README.md](../ridecore/README.md)):

```text
src/services/ src/routing/ src/offline/ src/database/ src/theme/ src/types/ src/hooks/
                                The engine
src/components/MapView.tsx      The map component RIDECORE draws its map with
src/main.tsx src/app/ the rest of src/components/
                                TrailCompass's own app: type-checked and tested, never built into RIDECORE
android/app/src/main/java/com/praneth2580/trailcompass/
                                TrailCompass's plugins: GPS, ride recorder, downloads, map files
public/ scripts/ index.html     Assets, build scripts, the page the app starts from
```

---

## 4. Architecture

**Entry.** `index.html` is TrailCompass's and names `src/main.tsx`. `ridecore/vite-plugin.ts` rewrites it to start `src/ridecore/main.tsx`. `main.tsx` does what TrailCompass's entry does: it loads TrailCompass's stylesheet (`src/index.css`, still needed for map markers, place popups and the map's credit), sets the `--tc-map-*` colour variables that stylesheet reads from `mapTheme`, and renders `<App />`. `ridecore.css` loads last, so its rules win.

**One door: `engine.ts`.** RIDECORE's screens and components import TrailCompass only through [`engine.ts`](../src/ridecore/engine.ts). When a merge changes one of TrailCompass's APIs, the type check fails there, and that file is where RIDECORE adapts. The only other places that import TrailCompass directly are `map-theme.ts` and the overrides, which are built around TrailCompass's modules by design. `engine.ts`:

- Re-exports the services RIDECORE uses (`navigationService`, `mapService`, `locationService`, `compassService`, `tripPlanner`, `rideLogService`, `routeLibrary`, `mapPackService`, `voiceGuidance`, `backgroundPlanning`, `downloadPolicy`, `offlineRoutingAdapter`), `MapView`, `useKeepAwake`, the formatting helpers and the types.
- `planTo(stop)` plans from here to a place (§6). It resolves to an error message, or `null` once routes are on offer. A counter (`planToken`) is bumped by every plan and every end, so a slow plan can't land after a newer plan or after the trip was ended.
- `endTrip()` ends the trip, planned or under way: the route, destination and stops all go.
- `offerSavedRoute(route)` puts a saved trip on offer, ready to start without planning.
- `getRouteOptions()` / `setRouteOptions()`: the route type (Fastest, Shortest, Less traffic) and whether expressways are allowed. TrailCompass keeps the expressways choice itself; its route type lasts only as long as the app, so RIDECORE keeps that one (`ridecore.routeProfile`).
- `getSpeedZoom()` / `setSpeedZoom()`: the zoom-by-speed multiplier (×0.5, ×1, ×1.5), kept in `ridecore.zoomMultiplier` and restored when the module loads, before the map first zooms (§11).

**Start-up: `app/useRideCore.ts`.** Mounted once by `App`, it starts the engine the way TrailCompass's `src/app/App.tsx` does, and turns what the engine is doing into React state (`RideCoreState`: `fix`, `locationError`, `compass`, `nav`, `engine`, `trip`, `ride`, and `now`, which ticks every second for the clock, the ride timer and stale GPS). It:

- Feeds each new GPS fix into `navigationService.updatePosition()` before rendering it, and each navigation state into `voiceGuidance.update()`.
- Puts the destination and route back on the map whenever the map style reloads.
- Shows a toast when a ride is saved, or why it wasn't.
- Starts the planning notification (`backgroundPlanning.watch()`), GPS, the compass, the routing engine and the download policy, picks up a ride still being recorded (`rideLogService.init()`), and deletes the offline maps of trips that no longer exist.
- Checks for new fuel and food data 20 seconds after start (`checkForPoiUpdate`, from TrailCompass's website).
- Leaves out TrailCompass's in-app update check on purpose: it would offer TrailCompass's releases.

If TrailCompass adds start-up work to its `App.tsx`, mirror it here ([ridecore/README.md → Pulling in TrailCompass](../ridecore/README.md#pulling-in-trailcompass)).

**State.** As in TrailCompass, state lives in the engine's singleton services, each with `getState()` and `subscribe()`. RIDECORE's own state is small and lives in `App` (which page, which mode, the rider's choices). Music is the exception: `media.ts` and `radio.ts` keep small stores of their own, read with React's `useSyncExternalStore`, because the Music screen, the dash and Settings all show them. Settings that belong to RIDECORE are read and written by small modules (`dash.ts`, `recent.ts`, `radio.ts`, `device.ts`, `engine.ts`) in `localStorage` (§12).

---

## 5. The shell

[`app/App.tsx`](../src/ridecore/app/App.tsx) is the device: a status line over two pagers, plus a toast.

### 5.1 The screens

```text
                          Settings             row 0   (pulled down)
  page 0 Music  ◄──  page 1 [ Dash ]  ──►  page 2 Where to / Trip  ──►  page 3 Rides
                          Apps                 row 2   (pulled up)
```

| Page | Screen | File |
|---|---|---|
| 0 | Music (left of the dash) | `screens/MusicPage.tsx` |
| 1 | The dash's column: Settings / dash / Apps | `App.tsx`, `screens/SettingsPage.tsx`, `screens/AppsPage.tsx` |
| 2 | Where to, or Trip | `screens/GoPage.tsx`, `screens/TripPage.tsx` |
| 3 | Rides: the recorder, and past rides under it | `screens/RidesPage.tsx`, `components/Recorder.tsx` |

A plus round the dash, each screen where a rider would reach for it, so everything is a swipe away and Rides two: settings pulled down from above and the apps pulled up from below, as on Android; music to the left; where to (ahead) to the right, with rides beyond it. The outer `Pager` runs left and right (`axis="x"`) through pages 0–3 and starts on page 1 (`home={DASH}`). Page 1 is itself a `Pager` running up and down (`axis="y"`, `home={1}`): Settings, the dash, Apps. Up and down only works on the dash, as on a phone's home screen.

Rules the shell keeps:

- **The way back is the way in.** While Settings or Apps is open, the outer pager is held on the dash (`hold`), so a sideways swipe there goes nowhere instead of carrying the column off to another screen. Each has a handle on its edge toward the dash (`Page`'s `handle`): outside its scrolling list, so a swipe on it always goes back, however far down the list is; a tap does too.
- **Leaving the dash's column sideways closes it.** Only possible from the dash itself now; `changePage` still snaps the column back without animating, as a safeguard.
- **The status line** (`StatusLine`) sits above both pagers while the dash mode is on, so it shows over every page. It hides while the map has the screen.
- **The screen stays on** (`useKeepAwake`) all the time unless Settings → Screen on is set to Navigating, and always while navigating.
- **A clean map to start with.** On the very first start RIDECORE switches TrailCompass's fuel and food pins off (`mapService.setOverlaysShown(false)`) and marks that done in `ridecore.pinsDefault`. Settings → Fuel & food switches them back on.
- **Music and weather run from the start.** `followMedia()` (in `media.ts`) follows the phone's music for as long as RIDECORE runs. `useWeather()` fetches the weather while either weather part (dash or top line) is switched on.
- **Toasts** (`useRideCore`'s `Toast`) show for 3.2 seconds.
- **The layout is read first.** Until `device.getLayout()` answers, `App` draws a black screen; with no layout picked yet, it shows `ChooseLayout` instead of the device.

### 5.2 Modes

`mode` (`ZoneMode` in `components/MapZone.tsx`) decides what the map does and whether the pages can move:

| Mode | When | The map | The pagers |
|---|---|---|---|
| `dash` | Normally | Across the dash, following the rider, zooming with speed. Taps open it; swipes pass through it. | Free |
| `map` | The dash's map was tapped, or a ride was opened from Rides | Takes the whole screen to look around, with a close chip and "back to me" | Held on the dash, other pages hidden (`hold` + `solo`) |
| `route` | Navigation status `planning`, `choosing` or `error` | Takes the whole screen, with the route panel over it | Held on the dash, other pages hidden |

While searching on Where to, the outer pager is held on that page instead (`hold={GO}`), so the keyboard and the results can't be swiped away. While Settings or Apps is open, it's held on the dash (§5.1).

### 5.3 Going back to the dash

| What happens | Result | Where |
|---|---|---|
| Home pressed (RIDECORE is the home app) | Closes the full-screen map and the search, then shows the dash. A route being chosen stays chosen. | `homeRef`, the plugin's `home` event |
| Back | Choosing a route: ends it. Map open: closes it. Searching: closes the search. Otherwise: shows the dash. Never leaves RIDECORE. | `backRef`, Capacitor's `backButton` |
| 30 s untouched on another page | Each pager goes back home on its own. The outer one closes the search first. Not while a text field has focus, nor while the map has the screen. | `Pager`'s `returnAfterMs` |
| A turn under 400 m away while navigating, or arriving | Both pagers jump to the dash | An effect on `turnNear` and `nav.status` |
| A turn coming up while navigating (on the route, not rerouting) | The screen's edge on the turn's side glows, over any page | `turnGlow()` in `glow.ts`, drawn by `TurnGlowEdges` |

The Back and Home handlers are kept in refs and refreshed on every render, so the listeners registered once always see the current state.

---

## 6. A trip, end to end

1. **Pick a place.** On Where to, the rider taps a recent place or a search result. `GoPage` moves it to the front of the recent places (`rememberPlace`) and calls `App.plan(stopFor(place))`. "Where to?" on the dash just swipes to that page and puts the cursor in the search after 450 ms.
2. **Plan.** `planTo()` (in `engine.ts`) sets the saved route type, sets the destination on the trip planner, the map and navigation, clears stops and waypoints, cancels any plan still running, and shows "Getting GPS…". The start is a fresh fix (up to 8 s), else the last fix, else the map's centre. It then calls `navigationService.planRoute()`. TrailCompass's planning notification, with Pause and Stop, runs alongside.
3. **Choose.** Navigation goes `planning` → `choosing` (or `error`), so the shell enters `route` mode. The map stops following and frames every route on offer once it has its new size (80 ms). `RoutePanel` lists them; a tap on a route or its line on the map selects it. Changing the route type or expressways saves them and plans again. × or Back ends the trip (`endTrip()`).
4. **Start.** `navigationService.startNavigation(selected)` and the map follows the rider again. Mode goes back to `dash`, and page 2 becomes `TripPage`. If Settings → Auto-record is on, the engine records the ride too.
5. **Ride.** The dash shows the next turn over the map (`MapZone`'s banner: the turn's arrow, distance, and the instruction, or "Finding a new route" while rerouting). The trip readout shows time to go, distance left and arrival, ahead of the ride, music and weather. Voice prompts come from `voiceGuidance`. As a turn comes up, the screen's edge on its side glows (`glow.ts`): it starts 12 seconds out at the rider's speed (never closer than 150 m nor further than 500 m), grows to full at the turn, softer for a slight turn, and pulses inside 35 m or 3 seconds. A U-turn lights the right edge (left-hand traffic); arriving lights both, green. Not while off route or rerouting. Off route, TrailCompass reroutes on its own.
6. **Arrive.** The dash comes back, its banner says "Arrived · tap to finish", and `TripPage` shows Finish. Either one calls `endTrip()`.

**A saved trip** skips planning: its card on Where to calls `offerSavedRoute()`, which loads it straight into `choosing`. It rides as it was saved, so `RoutePanel` says "Saved trip" and has no options to change.

---

## 7. Screens

Each screen after the dash is a `Page` (§8): its name small and centred at the top, then its content across the whole width.

### `ChooseLayout.tsx`
First start only: "How is the phone mounted?", with two pictures (`LayoutPicture`, also used in Settings) for Landscape and Portrait. The choice goes to `device.setLayout()`, which keeps it and locks the screen that way.

### The dash (in `App.tsx`)
Not a `Page`: a `<main className="rc-cluster">` holding `SpeedDial`, `MapZone` and `TripReadout`, each shown only if switched on in Settings (`data-speed`, `data-map`, `data-trip` set to `off` hand the room to the rest in CSS). With the map off, the next turn still shows. With all three off, a line says where to switch them back on.

The readout shows one thing at a time, the first that applies: the **trip**, the **ride** being recorded, the **music** playing, the **weather**, else the **clock** (§8, `TripReadout`). Music and weather appear there only if their own dash parts are on, and the readout itself needs Trip on.

### `SettingsPage.tsx`
Swiped down from the dash. Settings are `Key`s in grids, in five groups:

| Group | Keys |
|---|---|
| On the dash | Speed, Map, Trip, Where to, Music, Weather; Speed zoom (tapped through ×0.5, ×1, ×1.5) |
| Status | Clock, Heading, Weather (the top line); Network, GPS, Headset, Battery (the dash's corners, else the top line) |
| Riding | Voice; Turn glow; Fuel & food (the map's pins); Auto-record (every trip); Screen on (Always / Navigating) |
| Mounted | Landscape or Portrait, as pictures |
| Phone | Home app (its state says whether RIDECORE is it; a tap opens Android's home app screen); Music info (Allowed / Tap to allow: a tap opens Android's notification access screen); Offline maps (count and size, a tap lists them); Phone settings |

Every key in the first two groups is one flag in `DashShows` (`dash.ts`), and so is Turn glow (`turnGlow`). The two Weather keys are separate: `weather` is the dash readout, `topWeather` the top line. Network, GPS, Headset and Battery each switch their mark wherever it shows. The home status is checked again whenever RIDECORE comes back to the front, so it updates after the rider returns from Android's settings. Music info follows the same phone media state as the Music screen, so it updates too.

### `MusicPage.tsx` — Music
Left of the dash: one swipe right from it. Built on `media.ts` and `radio.ts` (§9):

- **The player:** what plays now, from the phone's music apps or RIDECORE's radio: the cover or station logo, the title, and a second line (artist and app, "Radio · tags", "Tuning in…", or the error). Three round keys: back, play/pause, next. Next and back step through the phone app's tracks, or through the station list the radio was started from. Tapping the title of the phone's music opens the app playing it.
- **Show what plays:** while the phone hasn't given notification access, a key opens Android's screen for it (`device.openMediaAccess()`). The controls work without it.
- **Favourite stations:** starred stations as keys, lit while playing. A tap plays one (or pauses it if it's the one playing); a long press unstars it.
- **Radio:** up to 80 of the country's most played stations with HTTPS streams, from Radio Browser, each with a star. The country is India when the phone's time zone is India's, else the region in the phone's language settings (US is skipped, as many Indian phones are set to US English), else India. Read the first time the page comes into view, then kept for as long as RIDECORE runs. Without a connection it offers Try again.

In landscape the player sits beside the radio list, which scrolls on its own.

### `AppsPage.tsx`
Swiped up from the dash: the phone's apps as a grid of icons, sorted by name, from `device.listApps()`. A tap opens the app. A long press (Android's web view reports it as a context menu) pins or unpins it; pinned apps show first, under "Pinned". The list is read when the page comes into view and again when RIDECORE resumes. In a browser it says the list is on the phone only.

### `GoPage.tsx` — Where to
Typing on a mounted phone is slow, so taps come first:
1. **Again:** the last six places gone to, as keys (`recent.ts`). A long press forgets one.
2. **Saved trips:** cards with the route's shape, distance and time (`routeLibrary.list()`, read again each time the page comes into view).
3. **Search:** one field; the keyboard's search key runs it (Nominatim, through `searchPlaces`, nearest first, so it needs a connection). Only the newest search shows its results.

A tap in the field starts searching (`onSearching(true)`): the page becomes a filled page, its field stays put and the results scroll inside it, and the outer pager holds it. ×, Back, picking a place, Home, or 30 seconds left alone with the keyboard down ends the search (`clear()`, also exposed to `App` through a ref).

### `TripPage.tsx` — the trip under way
Replaces Where to while navigation is `navigating`, `rerouting`, `paused` or `arrived`. Titled "Trip", with the destination (or saved trip's name) under it:
- Time to go, distance left and arrival, as big as the dash's numbers.
- Two round keys: Voice on/off, and End trip. End needs a second tap within 3 seconds ("Tap again"); after arriving it's a single tap on Finish.
- The next 8 turns (`turns.ts`), each with its arrow and distance. Beside the rest in landscape, under it in portrait.

### `RidesPage.tsx` — Rides
Two swipes right of the dash, beyond Where to. On top, the recorder (`components/Recorder.tsx`): one big face to tap to record, pause, carry on (`rideLogService.start/pause/resume`). While a ride is on, the face shows its distance and running time, and a Save ride key finishes it (`rideLogService.finish()`; the saved toast comes from `useRideCore`). The line under the title says Recording, Recording with navigation, Paused or Not recording, and is red while recording.

Under it, "Past rides": every ride recorded, newest first, as cards: the track's shape, distance, moving time, date and top speed. Read again each time the page comes into view and when a ride is saved. In landscape the face sits beside the rides, which scroll on their own. A tap on a ride shows it on the map: `App` opens `map` mode without following the rider, then calls `rideLogService.showOnMap()` 80 ms later, so the ride is framed at the map's full-screen size. Closing the map hides it again.

---

## 8. Components

| File | What it is |
|---|---|
| `Pager.tsx` | The watch-like pager. Its children are pages, laid side by side (`x`) or stacked (`y`); CSS scroll snapping does the swiping. It works out the page in view from the scroll position, draws the dots, and exposes `show(index, smooth?)`. `hold` pins it to one page, also when the screen resizes (the keyboard, the phone turning); `solo` hides the other pages too. After `returnAfterMs` without a touch, key press, scroll or focus inside it, it goes back to `home`, calling `onReturn` first. |
| `Page.tsx` | One screen: a small centred title, an optional line under it (`subTone="live"` makes it red), an optional `top` that stays put (the search field), and the body. `fill` makes it exactly one screen, its body scrolling inside. `handle` puts a "Dash" grip on the edge toward the dash (Settings: bottom, Apps: top), outside the body, so a swipe on it goes back however long the list; a tap does too. |
| `Recorder.tsx` | The ride recorder's face and its Save ride key, on the Rides screen. |
| `Key.tsx` | A device key: an icon, a word or two and a state, lit lime when on. `on` makes it a switch; `steps` draws dots for a setting with a few values. Without either it's an action key. |
| `Toggle.tsx` | A whole-row on/off switch with a hint. Only used for Expressways in the route panel. |
| `MapZone.tsx` | The map in all three modes (§5.2): `MapView`, the turn banner (a button when it says Arrived), "Where to?" when idle, the close chip and "back to me" in `map` mode, or the route panel in `route` mode. It tells `mapService` what the banner, buttons or panel cover (`setTopInset`, `setBottomInset`, `setSideInset`) so the rider and routes stay clear of them, re-measuring on every resize. It switches zoom by speed on in `dash` mode (§11). |
| `RoutePanel.tsx` | Choosing a route: the destination, a grey line (planning progress, the error, or arrival time with the route type), ×, the routes on offer as chips in their map colours, Start (or Try again), and further down the route type and Expressways. Down the left in landscape, along the bottom in portrait. |
| `SpeedDial.tsx` | The speedometer: a 270° lime arc over fine ticks, filling at 160 km/h, the speed large in the middle. A dash with no speed. |
| `TripReadout.tsx` | The most useful thing right now, in this order: while navigating, time to go, distance left, arrival and a progress bar; while recording, distance and ride time; what plays (title, artist or station, a play/pause mark), and then the whole readout is a button that plays or pauses it; the weather (temperature, what it's doing, the chance of rain); otherwise the clock and date. A dial on the right in landscape, a line under the map in portrait. |
| `StatusLine.tsx` | The top line: time and date, compass heading, the weather (an icon and the temperature, plus an umbrella and the chance when rain is 40% likely or more in the next three hours), REC with distance while recording (always shown). Away from the dash, or on it in portrait with the speedometer off, it also carries the phone's state as small icons (`cornersShown` false). Each part except REC can be switched off. |
| `StatusCorners.tsx` | The phone's state in the room round the dials, as a car's warning lights sit round its gauges: network top left, GPS top right, a headset bottom left (only while connected), battery bottom right. Drawn twice, `place="speed"` (the speedometer's corners, portrait) and `place="cluster"` (the dash's corners, above and below the dials, landscape); the stylesheet shows the one for the orientation. Never takes a tap. In landscape, a dial switched off leaves 7 rem of room so the turn card clears its corners. |
| `StatusMarks.tsx` | The marks themselves: signal bars (or Wi-Fi, airplane, offline), GPS (green, lime when weak, red when lost), the battery filling to its charge (lime while charging, red at 15% or less), the headset's name. Grey while all is well; a word only when something's wrong. `compact` drops the words for the top line. |
| `TurnGlowEdges.tsx` | The edge glow for turns: two bands of light down the screen's sides, fixed over every page, never taking a tap. Each one's opacity is the glow's strength, so it fades in and out; it beats while `urgent`, and turns green for arriving. Still under `prefers-reduced-motion`. |
| `ManeuverGlyph.tsx` | A turn's arrow (straight, slight, turn, sharp, U-turn, arrive), drawn for the right and mirrored for the left. U-turns go round to the right, for left-hand traffic. |
| `TrackThumb.tsx` | A route or ride's line fitted into a small square, scaled for latitude, with its start and end marked. |
| `Empty.tsx` | An empty page: a quiet icon, a title and how it fills. |
| `Icons.tsx` | RIDECORE's icons: one plain stroke, round ends, in the text's colour. |

---

## 9. Small modules

| File | What it does | Test |
|---|---|---|
| `dash.ts` | What the dash shows (`DashShows`, one flag per part). `loadDashShows()` starts with everything on and keeps only valid saved flags, so a part added later shows by default. | `dash.test.ts` |
| `recent.ts` | Recent places: newest first, at most `RECENT_MAX` (6). Going to a place again moves it to the front; the same name within about 50 m is the same place. `stopFor()` turns one into a trip destination. | `recent.test.ts` |
| `turns.ts` | `upcomingTurns()`: the turns still ahead, each with its distance from the rider (the next one's countdown, plus each instruction's leg after it). Still gives the next turn when it isn't on the route passed in (just after a reroute). | `turns.test.ts` |
| `media.ts` | What plays, wherever from. Follows the phone's music (`followMedia()`: the plugin's `media` event, and a fresh read on resume) and remembers which source was used last. `nowPlaying()` picks the one to show: the radio while it plays or tunes in, else the phone's while it plays, with both paused the one used last, else whichever there is. One plays at a time: `playStation()` pauses the phone's music, and the phone starting to play (from its app or a headset) pauses the radio. `togglePlay()`, `skip()` and `canSkip()` drive the player keys; the radio's next and back step through the list the station was picked from. Hooks: `usePhoneMedia()`, `useRadio()`, `useNowPlaying()`. | `media.test.ts` |
| `radio.ts` | Internet radio. `fetchStations(country)` asks Radio Browser for the country's most played stations (HTTPS only, broken ones hidden, 12 s timeout); `parseStations()` keeps HTTPS streams and logos, each name once, with two tags; `radioCountry()` picks the country (§7). The player (`radio`) is one HTML audio element in the web view: a station still silent after 15 s has failed, and a paused live stream starts again from now. Favourites: `loadFavourites()`, `toggleFavourite()`, at most 12, kept in `ridecore.radioFavourites`. HTTPS only because the app is served over `https` (`androidScheme`) with mixed content off. | `radio.test.ts` |
| `weather.ts` | The weather from Open-Meteo: temperature, a WMO weather code in words (`describeWeather()`), wind, and the highest chance of rain over the next three hours (`parseWeather()`). `useWeather()` asks about the rider's position rounded to a ~5 km grid (`weatherSpot()`, 0.05°), so only that square is sent and moving across town doesn't fetch again. Read again every 15 minutes, on resume, and on riding into the next square. | `weather.test.ts` |
| `status.ts` | The phone's state for the corners. `networkMark()` picks what to show: airplane mode; else Wi-Fi; else signal bars with a SIM; else "Offline" (nothing when online without either). A word only when something's wrong: "No signal" (0 bars), "No internet", "Offline". `headsetName()`: the headset's name, or "Bluetooth" / "Headset". `usePhoneStatus(active)` follows the `status` event and reads again on resume and every 15 s while active. Also `useMediaQuery()`. | `status.test.ts` |
| `glow.ts` | `turnGlow(kind, distance, speed)`: the edge glow for the next turn, or null. The side from the turn's kind (left, right; a U-turn right; arriving both); where it starts from the speed (12 s out, 150–500 m); its strength from 0.3 to 1 as the turn comes (0.65 of that for a slight turn); urgent inside 35 m or 3 s. | `glow.test.ts` |
| `format.ts` | Speed in km/h (none for a stale fix), the clock and date in the phone's own format, compass points, the ride timer, file sizes. | — |
| `device.ts` | The web side of `RideCoreDevicePlugin` (§10), with a browser fallback that keeps the layout in `localStorage` and has no home screen, apps or phone music (`NO_PHONE_MEDIA`). Also the Screen on setting (`loadKeepScreenOn`, on unless turned off). | — |
| `map-theme.ts` | RIDECORE's map colours (`RIDECORE_MAP_THEME`): TrailCompass's `dark` preset underneath, a neutral black basemap, the route in green, the rider in lime. A build's env still wins ([ridecore/README.md → Map colours](../ridecore/README.md#map-colours)). | `map-theme.test.ts` |
| `app/useBattery.ts` | The battery level and charging, from the web view's Battery API. Null where it isn't available. | — |

---

## 10. Android and the build hook

### 10.1 `RideCoreDevicePlugin`

[`RideCoreDevicePlugin.java`](../android/app/src/main/java/com/praneth2580/ridecore/RideCoreDevicePlugin.java), registered by one line at the top of TrailCompass's `MainActivity.onCreate`. Web side: `device.ts`. The music half is done by `RideCoreMedia.java` (below).

| Method or event | What it does |
|---|---|
| `getLayout()` / `setLayout({ layout })` | The mounting, kept in the `ridecore-device` SharedPreferences. Applied in `load()`, as the app starts and before the page draws, as `SENSOR_LANDSCAPE` or `SENSOR_PORTRAIT`: held that way, either way up. |
| `getHomeStatus()` | Whether Home opens RIDECORE: resolves the HOME intent and compares the package. |
| `openHomeSettings()` | Android's default home app screen, or its main settings on phones that hide that screen. |
| `openSettings()` | Android's settings: the way out to Wi-Fi, Bluetooth and the rest of the phone. |
| `listApps()` | Every app with a launcher entry except RIDECORE: package, activity, label, and the icon drawn at 56 dp as a PNG data URL (missing if it won't draw). |
| `openApp({ packageName, activity? })` | Opens it as a home screen does (`NEW_TASK`, `RESET_TASK_IF_NEEDED`). Rejects with "That app is no longer on the phone". |
| `home` event | Fired from `handleOnNewIntent` when a HOME intent arrives, which is Home being pressed while RIDECORE is the home app (`MainActivity` is `singleTask`). |
| `getMedia()` | What the phone plays (`PhoneMedia`: whether access is given, playing or not, title, artist, app, package, cover as a JPEG data URL). Starts following the phone's media sessions first, in case access was just given. |
| `mediaControl({ action })` | `play`, `pause`, `toggle`, `next` or `previous`, to whichever app plays. |
| `openMediaAccess()` | Android's notification access screen for RIDECORE's listener (the per-app screen on Android 11 and later, the list before that). |
| `media` event | What plays changed: another track, paused, another app. Also sent on every resume. |
| `getStatus()` | The phone's state for the dash (`PhoneStatus`): airplane mode; SIM present, its signal level (0–4, Android 9 and later) and operator; Wi-Fi or mobile data; online (validated); a headset (Bluetooth first, else wired or USB) and its name. |
| `status` event | The connection or the headset changed (network and audio-device callbacks, settled for 300 ms). The signal level isn't pushed: the web side reads it again every 15 s while the dash shows (`usePhoneStatus`). |

The plugin starts `RideCoreMedia` in `load()`, starts it again and sends a `media` event on resume (access may just have been given in Android's settings), and stops it in `handleOnDestroy()`.

**`RideCoreMedia.java`** follows the phone's media sessions through `MediaSessionManager`. Android only lists other apps' sessions while one of the app's notification listeners has access, so it does nothing until the rider has given it. The session shown is the first one playing, else the most recent. Covers are scaled to 256 px and encoded once per track. Controls go to that session's transport controls. With no access, or no app with a media session, they go out as media key presses through `AudioManager`, as a headset's buttons do, and the app that played last takes them. That's why play, pause and skip work without access.

**`RideCoreStatus.java`** reads what needs no permission: the SIM state and `getSignalStrength().getLevel()` from `TelephonyManager`, the active network's transports and validation from `ConnectivityManager`, airplane mode from settings, and output devices from `AudioManager`. The network type (4G, 5G) is left out on purpose: it needs `READ_PHONE_STATE`, the "make and manage phone calls" prompt.

**`RideCoreMediaListener.java`** is an empty `NotificationListenerService`. It exists only to be the thing the rider gives notification access to.

**Manifest additions** (`AndroidManifest.xml`, TrailCompass's file):
- A second intent filter on `MainActivity` (`MAIN` with `HOME` and `DEFAULT`), so RIDECORE can be picked as the home app. TrailCompass's own launcher filter is untouched.
- A `<queries>` entry for launcher activities, without which Android 11 and later hide other apps from `listApps()`.
- The `RideCoreMediaListener` service, exported, guarded by `BIND_NOTIFICATION_LISTENER_SERVICE`, with the `NotificationListenerService` intent filter.

The Java package stays `com.praneth2580.trailcompass` for TrailCompass's files so they merge as they are; RIDECORE's own Java lives in `com.praneth2580.ridecore`. Only the app ID changed ([ridecore/README.md → Where RIDECORE edits TrailCompass's files](../ridecore/README.md#where-ridecore-edits-trailcompasss-files)).

### 10.2 `ridecore/vite-plugin.ts`

Added to `plugins` in `vite.config.ts`. It does three things:

- **Entry.** `transformIndexHtml` swaps `src="/src/main.tsx"` for RIDECORE's entry and sets `theme-color` to black. If `index.html` no longer has that line, the build fails rather than quietly ship TrailCompass's app.
- **Overrides.** `resolveId` sends every import of `src/<path>` to `src/ridecore/overrides/<path>` when that file exists. An override importing the file it replaces gets the original, so it can wrap it. A relative import inside an override that finds nothing beside it resolves from the original's folder. Tests always get the very file they name, and nothing in `overrides/` replaces a test. Adding or removing an override restarts the dev server. `tsconfig.app.json`'s `rootDirs` lets TypeScript resolve imports the same way.
- **The name.** `transform` replaces the word "TrailCompass" with "RIDECORE" in TrailCompass's code (not RIDECORE's), so notifications, share messages and errors say RIDECORE without editing them. URLs, paths, identifiers and the lowercase `trailcompass` in file formats and storage keys are left alone ([ridecore/README.md → The name](../ridecore/README.md#the-name)).

---

## 11. Overrides and zoom by speed

Two overrides are in use ([ridecore/README.md → Overrides](../ridecore/README.md#overrides) has the rules):

- **`overrides/services/nav-display.ts`** wraps TrailCompass's and replaces only `navigationZoomForSpeed()`. RIDECORE's map is under half the screen TrailCompass zooms for, so the zoom is pulled back 1.3 levels (`ZOOM_OUT`). How far it zooms out with speed is multiplied by the rider's choice (`setZoomMultiplier`); standing still is the same at any multiplier, and it never goes further out than zoom 11 (`FARTHEST_ZOOM`). Everything else is TrailCompass's, re-exported.
- **`overrides/theme/map-theme.ts`** is TrailCompass's `src/theme/map-theme.ts`, resolving RIDECORE's colours (`map-theme.ts`) under the build's env.

**How zoom by speed fits together.** TrailCompass zooms by speed only while navigating. RIDECORE wants it on the dash all the time, so `src/services/map.service.ts` (one of the few TrailCompass files RIDECORE edits) has `setFollowZoomBySpeed()`: off unless called, so TrailCompass behaves as before. `MapZone` turns it on in `dash` mode and off when the map has the screen, so the rider can zoom by hand there. `map.service.ts` imports `navigationZoomForSpeed` from `services/nav-display`, which the plugin points at the override; `engine.ts` imports the override directly to set the multiplier. Both get the same module, so the setting reaches the camera.

---

## 12. Storage

RIDECORE runs as its own app (`com.praneth2580.ridecore`), so its storage is separate from TrailCompass's on the same phone. Its own settings are in the web view's `localStorage`:

| Key | Holds | Written by |
|---|---|---|
| `ridecore.dash` | What the dash and top line show (JSON flags) | `dash.ts` |
| `ridecore.recentPlaces` | Recent places, newest first (JSON) | `recent.ts` |
| `ridecore.radioFavourites` | Starred radio stations, at most 12 (JSON, HTTPS streams only) | `radio.ts` |
| `ridecore.pinnedApps` | Package names pinned to the top of Apps (JSON) | `screens/AppsPage.tsx` |
| `ridecore.routeProfile` | Route type: `fastest`, `shortest` or `less_traffic` | `engine.ts` |
| `ridecore.zoomMultiplier` | `0.5`, `1` or `1.5` | `engine.ts` |
| `ridecore.keepScreenOn` | `false` when Screen on is Navigating | `device.ts` |
| `ridecore.pinsDefault` | Set once the fuel and food pins have been switched off at first start | `app/App.tsx` |
| `ridecore.layout` | The mounting, in a browser only | `device.ts` (web fallback) |

On Android the mounting is in SharedPreferences (`ridecore-device`, key `layout`), so the plugin can apply it before the page loads.

Everything else is the engine's and stored the engine's way: voice prompts, auto-record, expressways, the map's pins, the GPS mode, the Wi-Fi-only setting, saved trips, rides, road packs and offline maps. See TrailCompass's guide, [§10 Persistence](https://github.com/praneth2580/TrailCompass/blob/main/docs/PROJECT_GUIDE.md#10-persistence).

---

## 13. Styling

All of RIDECORE's look is [`styles/ridecore.css`](../src/ridecore/styles/ridecore.css), in sections that follow the device: the device, the screens (pagers), the speedometer, the map, the map taking the screen, the trip readout, keys, cards, the recorder, apps, music, the trip under way, turns, first start, toast.

- **Tokens.** `--rc-*` on `:root`: black background, tiles and raised greys, white text with a grey second line (`--rc-muted`, `--rc-copy`), one lime accent (`--rc-lime` `#dffe45`), green for the route, red for recording, two radii, and safe-area insets.
- **TrailCompass's tokens.** The `--tc-*` tokens are set to RIDECORE's colours and font, for what TrailCompass's stylesheet still draws: markers, place popups, the map's credit.
- **Swiping is CSS.** Each pager is a scroll container with `scroll-snap-type: mandatory` and `scroll-snap-stop: always`, containing overscroll in its own direction only, so a sideways swipe in the dash's column reaches the pages beside it. `data-hold` turns scrolling off; `data-solo` hides the other pages.
- **Two layouts.** `@media (orientation: landscape)` blocks change the layout: the dash puts the speed dial, the map and the trip side by side (the map running behind the two dials and fading out under them), key grids put the icon beside the word with more keys across, the trip page puts the turns beside the numbers, the Music screen puts the player beside the radio list, and the route panel moves to the left. Portrait stacks them.
- **The map has no box.** On the dash it runs the full width and its edges fade into the black (a CSS mask).
- **Down to 360 px.** Screens must work at 360 px wide or tall; under 380 px wide the status line drops the date.
- **MapLibre.** Style MapLibre's elements under `.tc-map-container`, never with MapLibre's own selectors: the minifier merges matching rules and one side's is lost. `ridecore-css.test.ts` checks this.

---

## 14. Tests

`npm test` runs RIDECORE's tests together with TrailCompass's, which keep testing TrailCompass's code.

| Test | Covers |
|---|---|
| `ridecore/vite-plugin.test.ts` | Builds a tiny app with the plugin: RIDECORE's entry is used, overrides replace and can wrap, relative imports in an override resolve, tests are never replaced, the name is put in, and URLs, identifiers and file formats are kept. |
| `nav-zoom.test.ts` | The zoom-by-speed override against TrailCompass's original: pulled back, more road when faster, the multiplier, the farthest zoom, bad multipliers ignored, the rest re-exported. |
| `map-theme.test.ts` | RIDECORE's map colours are valid, cover every basemap colour the dark preset sets, sit over the dark preset, and give way to a build's env. |
| `dash.test.ts` | What the dash shows: everything at first, choices kept, bad or missing values shown. |
| `recent.test.ts` | Recent places: order, moving to the front, same name far apart, the limit, forgetting, bad data skipped. |
| `turns.test.ts` | Turns ahead: distances, the limit, the next turn off the given route, nothing ahead. |
| `media.test.ts` | What plays: nothing, the phone's with artist and app, the radio over the phone while it plays, the phone's over a paused station, the one used last when both are paused, the app's name when there's no title. |
| `radio.test.ts` | Stations: HTTPS only, each name once, two tags; the country from the time zone or region. Favourites: star, unstar, the limit, bad data skipped. The player: a silent station fails after the timeout, one that answers plays. |
| `weather.test.ts` | Open-Meteo's answer read (temperature, weather, highest rain chance ahead), junk rejected, WMO codes in words, the ~5 km grid. |
| `styles/ridecore-css.test.ts` | No MapLibre selector in `ridecore.css`. |

The screens have no automated tests. Check changes on a phone or in the browser, in both portrait and landscape, down to 360 px.

---

## 15. Known gaps

What the engine can do but RIDECORE doesn't offer yet, and other loose ends. Checked against the code on 2026-11-06.

- **No saving, sharing or importing trips.** Nothing in RIDECORE calls `navigationService.saveActiveRoute()` or `routeLibrary.importFromFile()`. Where to's Saved trips reads `routeLibrary.list()`, and as its own app RIDECORE doesn't see TrailCompass's trips, so on a phone that list stays empty for now.
- **No offline maps from RIDECORE.** Settings → Offline maps lists them, but there's no way to download a trip's map or an area here, so the list is empty on a fresh install. The map needs a connection for areas it hasn't loaded.
- **No stops.** No fuel or food stop suggestions, no waypoints: `planTo()` plans straight to one destination. Fuel and food pins can be shown on the map, but their popups have no Go here or Add stop (RIDECORE sets no popup actions).
- **No picking a place on the map.** Destinations come from search or recent places.
- **Rides can only be looked at.** No GPX export, delete, save as trip, or ride insights (usual routes, places and traffic).
- **Engine settings without a key.** The GPS mode (default: satellites with mobile data and Wi-Fi) and Wi-Fi only downloads (default: any network) keep the engine's defaults.
- **No in-app updates.** TrailCompass's update check is left out because it would offer TrailCompass's APKs. New RIDECORE versions are installed by hand from its releases.
- **TrailCompass's icon.** The app icon, splash screens and `public/` icons are still TrailCompass's.
- **Fuel and food data from TrailCompass's site.** The data update URL in `poi-data.service.ts` points at TrailCompass's website, which is intended: it isn't renamed.
- **What needs a connection.** Search (Nominatim), radio stations and streams (Radio Browser and the stations themselves), and the weather (Open-Meteo). Showing and controlling the phone's music apps doesn't (though a streaming app may).
- **Radio is HTTPS only.** Stations without an HTTPS stream aren't listed: the web view blocks plain HTTP audio.
- **The radio lives in the web view.** It's one HTML audio element, with no Android media session or notification of its own (`RideCoreMedia` only follows other apps).

TrailCompass's own known issues apply to the engine underneath: [its §19](https://github.com/praneth2580/TrailCompass/blob/main/docs/PROJECT_GUIDE.md#19-known-issues-and-gaps).

---

## 16. Cheat sheet

```bash
npm install                 # "ERESOLVE overriding peer dependency" warnings are expected
npm run dev                 # RIDECORE in the browser; the window decides the layout
npm test && npm run lint && npm run build
npm run cap:run             # build, install and launch on a phone (JDK 21; see DEVELOPMENT.md)

# What RIDECORE changes in TrailCompass's files
git diff --stat upstream/main -- . ':!ridecore' ':!src/ridecore'
```

| To change… | Look in |
|---|---|
| Which screens there are, and their order | `app/App.tsx` (the page and row constants, the two `Pager`s) |
| When the dash comes back | `app/App.tsx` (`RETURN_AFTER_MS`, `TURN_NEAR_M`, Back and Home handlers) |
| How swiping feels | `components/Pager.tsx` and the pager rules near the top of `ridecore.css` |
| What the engine is asked to do | `engine.ts` |
| A setting | `screens/SettingsPage.tsx`, plus where it's kept (§12) |
| Music, radio, weather | `screens/MusicPage.tsx`, `media.ts`, `radio.ts`, `weather.ts`; the readout in `components/TripReadout.tsx` |
| Anything native | `RideCoreDevicePlugin.java` (music: `RideCoreMedia.java`; signal and headset: `RideCoreStatus.java`) and `device.ts` |
| A TrailCompass module's behaviour | Prefer a change upstream in TrailCompass; otherwise an override ([ridecore/README.md](../ridecore/README.md#overrides)) |
| Merging TrailCompass, releasing | [ridecore/README.md](../ridecore/README.md) |

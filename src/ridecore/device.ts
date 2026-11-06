/**
 * The phone RIDECORE runs on, kept for it alone: the screen layout the rider picked,
 * RIDECORE as the home screen, the phone's other apps to open from it, and the music
 * they play. Native side:
 * android/app/src/main/java/com/praneth2580/ridecore/RideCoreDevicePlugin.java
 */
import { registerPlugin, WebPlugin, type PluginListenerHandle } from '@capacitor/core';

export type Layout = 'landscape' | 'portrait';

export interface HomeStatus {
  /** False in a browser: there is no home screen to be. */
  supported: boolean;
  /** Pressing Home opens RIDECORE. */
  isHome: boolean;
}

/** One of the phone's apps, as the home screen lists it. */
export interface PhoneApp {
  packageName: string;
  /** The activity that opens it, when the app has more than one way in. */
  activity?: string;
  label: string;
  /** A PNG data URL; missing when the icon wouldn't draw. */
  icon?: string;
}

/** What the phone's music apps play (Spotify, YouTube Music, a podcast app…). */
export interface PhoneMedia {
  /** False in a browser: there's no phone to play anything. */
  supported: boolean;
  /** Notification access given, so what plays can be seen. Controls work without it. */
  access: boolean;
  /** Something is playing or paused that can be shown. */
  active: boolean;
  playing: boolean;
  title?: string;
  artist?: string;
  /** The app playing it, by name and package. */
  app?: string;
  packageName?: string;
  /** The cover, as a JPEG data URL. */
  art?: string;
}

export type MediaAction = 'play' | 'pause' | 'toggle' | 'next' | 'previous';

/** The phone's connection, as the dash shows it. */
export interface PhoneNetwork {
  airplane: boolean;
  /** A SIM is in. */
  sim: boolean;
  /** The SIM's signal, 0 (none) to 4 bars; left out where the phone won't say. */
  level?: number;
  /** The mobile network's name. */
  operator?: string;
  /** On Wi-Fi, or on mobile data, right now. */
  wifi: boolean;
  mobileData: boolean;
  /** The internet actually reachable. */
  online: boolean;
}

/** A headset to hear navigation in: a helmet's Bluetooth intercom, or wired earphones. */
export interface PhoneHeadset {
  connected: boolean;
  kind?: 'bluetooth' | 'wired';
  name?: string;
}

export interface PhoneStatus {
  /** False in a browser, which can't tell. */
  supported: boolean;
  network?: PhoneNetwork;
  headset?: PhoneHeadset;
}

export const NO_PHONE_STATUS: PhoneStatus = { supported: false };

interface RideCoreDevicePlugin {
  /** Undefined until the rider has picked one. */
  getLayout(): Promise<{ layout?: Layout }>;
  /** Kept, and the screen held that way from now on, app restarts included. */
  setLayout(options: { layout: Layout }): Promise<void>;
  getHomeStatus(): Promise<HomeStatus>;
  openHomeSettings(): Promise<void>;
  openSettings(): Promise<void>;
  /** The phone's apps; supported is false in a browser, which has none to list. */
  listApps(): Promise<{ supported: boolean; apps: PhoneApp[] }>;
  openApp(options: { packageName: string; activity?: string }): Promise<void>;
  getMedia(): Promise<PhoneMedia>;
  /** To the app shown playing, else to whichever played last, as a headset's buttons do. */
  mediaControl(options: { action: MediaAction }): Promise<void>;
  /** Android's notification access screen, to let RIDECORE see what plays. */
  openMediaAccess(): Promise<void>;
  /** SIM and signal, Wi-Fi or offline, airplane mode, a headset. */
  getStatus(): Promise<PhoneStatus>;
  /** Home pressed while RIDECORE is the home screen. */
  addListener(eventName: 'home', listener: () => void): Promise<PluginListenerHandle>;
  /** The connection or the headset changed. The signal level isn't pushed: read it again. */
  addListener(eventName: 'status', listener: (status: PhoneStatus) => void): Promise<PluginListenerHandle>;
  /** What plays changed: another song, paused, another app. */
  addListener(eventName: 'media', listener: (media: PhoneMedia) => void): Promise<PluginListenerHandle>;
}

export const NO_PHONE_MEDIA: PhoneMedia = { supported: false, access: false, active: false, playing: false };

const LAYOUT_KEY = 'ridecore.layout';

/** In a browser: the choice is kept, but the window decides the layout. */
class RideCoreDeviceWeb extends WebPlugin implements RideCoreDevicePlugin {
  async getLayout(): Promise<{ layout?: Layout }> {
    const layout = localStorage.getItem(LAYOUT_KEY);
    return layout === 'landscape' || layout === 'portrait' ? { layout } : {};
  }

  async setLayout({ layout }: { layout: Layout }): Promise<void> {
    localStorage.setItem(LAYOUT_KEY, layout);
  }

  async getHomeStatus(): Promise<HomeStatus> {
    return { supported: false, isHome: false };
  }

  async openHomeSettings(): Promise<void> {}

  async openSettings(): Promise<void> {}

  async listApps(): Promise<{ supported: boolean; apps: PhoneApp[] }> {
    return { supported: false, apps: [] };
  }

  async openApp(): Promise<void> {}

  async getMedia(): Promise<PhoneMedia> {
    return NO_PHONE_MEDIA;
  }

  async mediaControl(): Promise<void> {}

  async openMediaAccess(): Promise<void> {}

  async getStatus(): Promise<PhoneStatus> {
    return NO_PHONE_STATUS;
  }
}

// One instance, made now: given a factory, Capacitor can make two when calls come at
// once on start-up, and a listener added to the first never hears events sent to the second.
export const device = registerPlugin<RideCoreDevicePlugin>('RideCoreDevice', {
  web: new RideCoreDeviceWeb(),
});

const KEEP_ON_KEY = 'ridecore.keepScreenOn';

/** Keep the screen on all the time, not just while navigating. On unless turned off. */
export function loadKeepScreenOn(): boolean {
  return localStorage.getItem(KEEP_ON_KEY) !== 'false';
}

export function saveKeepScreenOn(on: boolean): void {
  localStorage.setItem(KEEP_ON_KEY, String(on));
}

/**
 * The phone RIDECORE runs on, kept for it alone: the screen layout the rider picked,
 * and RIDECORE as the home screen. Native side:
 * android/app/src/main/java/com/praneth2580/ridecore/RideCoreDevicePlugin.java
 */
import { registerPlugin, WebPlugin } from '@capacitor/core';

export type Layout = 'landscape' | 'portrait';

export interface HomeStatus {
  /** False in a browser: there is no home screen to be. */
  supported: boolean;
  /** Pressing Home opens RIDECORE. */
  isHome: boolean;
}

interface RideCoreDevicePlugin {
  /** Undefined until the rider has picked one. */
  getLayout(): Promise<{ layout?: Layout }>;
  /** Kept, and the screen held that way from now on, app restarts included. */
  setLayout(options: { layout: Layout }): Promise<void>;
  getHomeStatus(): Promise<HomeStatus>;
  openHomeSettings(): Promise<void>;
  openSettings(): Promise<void>;
}

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
}

export const device = registerPlugin<RideCoreDevicePlugin>('RideCoreDevice', {
  web: () => new RideCoreDeviceWeb(),
});

const KEEP_ON_KEY = 'ridecore.keepScreenOn';

/** Keep the screen on all the time, not just while navigating. On unless turned off. */
export function loadKeepScreenOn(): boolean {
  return localStorage.getItem(KEEP_ON_KEY) !== 'false';
}

export function saveKeepScreenOn(on: boolean): void {
  localStorage.setItem(KEEP_ON_KEY, String(on));
}

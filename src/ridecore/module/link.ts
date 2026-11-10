/**
 * The USB line to the handlebar module. Native side:
 * android/app/src/main/java/com/praneth2580/ridecore/RideCoreModulePlugin.java
 * (and RideCoreUsbLink.java, the USB serial reader).
 */
import { registerPlugin, WebPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { ButtonName } from './buttons';
import type { ButtonAction, ButtonMap } from './buttonmap';

export interface LinkState {
  /**
   * unsupported: a browser, no USB. none: nothing plugged in. allow: plugged in, waiting
   * for the rider to allow USB. asking: Android's dialog is up. open: talking. error: it
   * wouldn't open (error says why).
   */
  state: 'unsupported' | 'none' | 'allow' | 'asking' | 'open' | 'error';
  /** The board, as USB names it. */
  name?: string;
  error?: string;
  /** Answering and ending calls from a button: the phone permission's state. */
  calls?: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
}

/**
 * A button press, read by the phone (RideCoreModulePlugin.java). `done`: the phone did it
 * (volume, calls); `problem`: why it couldn't. "page": no map sent yet, the page's decides.
 */
export interface NativePress {
  button: ButtonName;
  hold: boolean;
  action: ButtonAction | 'page';
  done: boolean;
  problem?: string;
}

export interface RideCoreModulePlugin {
  getState(): Promise<LinkState>;
  /** Finds the module, asking for USB access if it needs to. */
  connect(): Promise<LinkState>;
  /** One line to the module. */
  send(options: { line: string }): Promise<void>;
  /** What each button does, for the phone to act on presses itself. */
  setButtons(options: { map: ButtonMap; callsOnOk: boolean }): Promise<void>;
  /** Asks for the phone permission to answer and end calls. */
  allowCalls(): Promise<{ calls: NonNullable<LinkState['calls']> }>;
  addListener(eventName: 'state', listener: (state: LinkState) => void): Promise<PluginListenerHandle>;
  /** Lines from the module, a few at a time. Not the buttons: those come as presses. */
  addListener(eventName: 'lines', listener: (event: { lines: string[] }) => void): Promise<PluginListenerHandle>;
  /** A tap or a hold, with what it's set to do, while RIDECORE is on screen. */
  addListener(eventName: 'press', listener: (press: NativePress) => void): Promise<PluginListenerHandle>;
}

/** In a browser there's no USB; ?module in the address runs the simulator while developing. */
class RideCoreModuleWeb extends WebPlugin implements RideCoreModulePlugin {
  private simulator: { send(line: string): void } | null = null;
  private starting: Promise<void> | null = null;

  private get simulated(): boolean {
    return import.meta.env.DEV && new URLSearchParams(window.location.search).has('module');
  }

  private startSimulator(): Promise<void> {
    // Development builds only: in a release the import is dropped, simulator and all.
    this.starting ??= import.meta.env.DEV
      ? import('./sim').then(({ simulateModule }) => {
          this.simulator = simulateModule((lines) => this.notifyListeners('lines', { lines }));
        })
      : Promise.resolve();
    return this.starting;
  }

  async getState(): Promise<LinkState> {
    if (!this.simulated) return { state: 'unsupported' };
    await this.startSimulator();
    return { state: 'open', name: 'Simulated module' };
  }

  async connect(): Promise<LinkState> {
    return this.getState();
  }

  async send({ line }: { line: string }): Promise<void> {
    this.simulator?.send(line);
  }

  // A browser reads the simulator's buttons itself (src/ridecore/module/index.ts).
  async setButtons(): Promise<void> {}

  async allowCalls(): Promise<{ calls: NonNullable<LinkState['calls']> }> {
    return { calls: 'denied' };
  }
}

export const moduleLink = registerPlugin<RideCoreModulePlugin>('RideCoreModule', {
  web: new RideCoreModuleWeb(),
});

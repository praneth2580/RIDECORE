import { describe, expect, it, vi } from 'vitest';
import type { PhoneNetwork } from './device';

vi.mock('./device', () => ({ NO_PHONE_STATUS: { supported: false }, device: {} }));
vi.mock('@capacitor/app', () => ({ App: {} }));
const { headsetName, networkMark } = await import('./status');

const net = (over: Partial<PhoneNetwork>): PhoneNetwork => ({
  airplane: false,
  sim: true,
  level: 3,
  operator: 'Jio',
  wifi: false,
  mobileData: true,
  online: true,
  ...over,
});

describe("the dash's network corner", () => {
  it('shows bars with a SIM, and no words while all is well', () => {
    expect(networkMark(net({}))).toEqual({ kind: 'signal', level: 3, label: 'Jio: 3 of 4 bars' });
  });

  it('says what is wrong, only when something is', () => {
    expect(networkMark(net({ level: 0, online: false }))).toMatchObject({ warning: 'No signal' });
    expect(networkMark(net({ online: false }))).toMatchObject({ kind: 'signal', warning: 'No internet' });
    expect(networkMark(net({ wifi: true, mobileData: false, online: false }))).toMatchObject({ kind: 'wifi', warning: 'No internet' });
  });

  it('shows Wi-Fi over the SIM while on it', () => {
    expect(networkMark(net({ wifi: true, mobileData: false }))).toEqual({ kind: 'wifi', level: null, label: 'Wi-Fi' });
  });

  it('without a SIM: Wi-Fi, or offline, nothing else', () => {
    expect(networkMark(net({ sim: false, level: undefined, wifi: true, online: true }))).toMatchObject({ kind: 'wifi' });
    expect(networkMark(net({ sim: false, level: undefined, mobileData: false, online: false }))).toMatchObject({ kind: 'offline', warning: 'Offline' });
  });

  it('says airplane mode, unless Wi-Fi is on in it', () => {
    expect(networkMark(net({ airplane: true, online: false }))).toMatchObject({ kind: 'airplane' });
    expect(networkMark(net({ airplane: true, wifi: true }))).toMatchObject({ kind: 'wifi' });
  });

  it('shows bars without a count where the phone gives none, and nothing in a browser', () => {
    expect(networkMark(net({ level: undefined }))).toEqual({ kind: 'signal', level: null, label: 'Jio' });
    expect(networkMark(undefined)).toBeNull();
  });
});

describe("the dash's headset corner", () => {
  it('names the headset, or what it is, and is empty with none', () => {
    expect(headsetName({ connected: true, kind: 'bluetooth', name: 'Packtalk Edge' })).toBe('Packtalk Edge');
    expect(headsetName({ connected: true, kind: 'bluetooth' })).toBe('Bluetooth');
    expect(headsetName({ connected: true, kind: 'wired' })).toBe('Headset');
    expect(headsetName({ connected: false })).toBeNull();
    expect(headsetName(undefined)).toBeNull();
  });
});

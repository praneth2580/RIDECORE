import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenSides } from './device';

const plugin = vi.hoisted(() => ({
  getCutout: vi.fn<() => Promise<ScreenSides>>(),
  listener: null as ((cutout: ScreenSides) => void) | null,
  removed: false,
}));

vi.mock('./device', () => ({
  device: {
    getCutout: plugin.getCutout,
    addListener: (_event: string, listener: (cutout: ScreenSides) => void) => {
      plugin.listener = listener;
      return Promise.resolve({ remove: () => void (plugin.removed = true) });
    },
  },
}));

const { cutoutVars, followCutout } = await import('./cutout');

function fakeRoot() {
  const values: Record<string, string> = {};
  return { values, style: { setProperty: (name: string, value: string) => void (values[name] = value) } };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('cutoutVars', () => {
  it('gives each side in whole pixels', () => {
    expect(cutoutVars({ top: 31.6, right: 0, bottom: 0, left: 12 })).toEqual({
      '--rc-cut-top': '32px',
      '--rc-cut-right': '0px',
      '--rc-cut-bottom': '0px',
      '--rc-cut-left': '12px',
    });
  });

  it('treats missing, negative and nonsense sides as none', () => {
    expect(cutoutVars({ top: -4, left: Number.NaN } as Partial<ScreenSides>)).toEqual({
      '--rc-cut-top': '0px',
      '--rc-cut-right': '0px',
      '--rc-cut-bottom': '0px',
      '--rc-cut-left': '0px',
    });
    expect(cutoutVars(null)['--rc-cut-top']).toBe('0px');
  });
});

describe('followCutout', () => {
  beforeEach(() => {
    plugin.listener = null;
    plugin.removed = false;
    plugin.getCutout.mockReset();
  });

  it('sets the cut-out at start and again when the phone turns', async () => {
    plugin.getCutout.mockResolvedValue({ top: 30, right: 0, bottom: 0, left: 0 });
    const root = fakeRoot();
    const stop = followCutout(root);
    await flush();
    expect(root.values['--rc-cut-top']).toBe('30px');

    plugin.listener?.({ top: 0, right: 0, bottom: 0, left: 30 });
    expect(root.values['--rc-cut-top']).toBe('0px');
    expect(root.values['--rc-cut-left']).toBe('30px');

    stop();
    await flush();
    expect(plugin.removed).toBe(true);
  });

  it('keeps a turn heard before the first answer came back', async () => {
    let answer: (cutout: ScreenSides) => void = () => undefined;
    plugin.getCutout.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const root = fakeRoot();
    followCutout(root);
    plugin.listener?.({ top: 0, right: 28, bottom: 0, left: 0 });
    answer({ top: 28, right: 0, bottom: 0, left: 0 });
    await flush();
    expect(root.values['--rc-cut-right']).toBe('28px');
    expect(root.values['--rc-cut-top']).toBe('0px');
  });

  it('leaves the page as it is in a browser that cannot say', async () => {
    plugin.getCutout.mockRejectedValue(new Error('not implemented'));
    const root = fakeRoot();
    followCutout(root);
    await flush();
    expect(root.values).toEqual({});
  });
});

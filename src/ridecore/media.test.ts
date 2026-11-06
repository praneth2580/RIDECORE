import { describe, expect, it, vi } from 'vitest';
import type { PhoneMedia } from './device';
import type { RadioState } from './radio';

vi.mock('./device', () => ({
  NO_PHONE_MEDIA: { supported: false, access: false, active: false, playing: false },
  device: {},
}));
vi.mock('@capacitor/app', () => ({ App: {} }));

const { nowPlaying } = await import('./media');

const phone = (over: Partial<PhoneMedia> = {}): PhoneMedia => ({
  supported: true,
  access: true,
  active: true,
  playing: true,
  title: 'Song',
  artist: 'Singer',
  app: 'Spotify',
  ...over,
});
const station = { id: 's', name: 'Radio City', url: 'https://r.example', tags: 'hindi' };
const radio = (status: RadioState['status']): RadioState => ({ station: status === 'idle' ? null : station, status });

describe('what plays', () => {
  it('is nothing with nothing on', () => {
    expect(nowPlaying(phone({ active: false, playing: false }), radio('idle'))).toBeNull();
  });

  it("is the phone's music, with artist and app", () => {
    expect(nowPlaying(phone(), radio('idle'))).toEqual({ source: 'phone', title: 'Song', subtitle: 'Singer · Spotify', art: undefined, playing: true });
  });

  it('is the radio while it plays or loads, over the phone', () => {
    expect(nowPlaying(phone(), radio('playing'))).toMatchObject({ source: 'radio', title: 'Radio City', subtitle: 'Radio · hindi', playing: true });
    expect(nowPlaying(phone(), radio('loading'))).toMatchObject({ source: 'radio', loading: true, playing: false });
  });

  it("is the phone's over a paused station, and the paused station with nothing else", () => {
    expect(nowPlaying(phone({ playing: false }), radio('paused'))).toMatchObject({ source: 'phone', playing: false });
    expect(nowPlaying(phone({ active: false }), radio('paused'))).toMatchObject({ source: 'radio', playing: false });
  });

  it('is the one used last when both are paused', () => {
    const paused = phone({ playing: false });
    expect(nowPlaying(paused, radio('paused'), 'radio')).toMatchObject({ source: 'radio', playing: false });
    expect(nowPlaying(paused, radio('paused'), 'phone')).toMatchObject({ source: 'phone' });
    // Playing beats used last.
    expect(nowPlaying(phone(), radio('paused'), 'radio')).toMatchObject({ source: 'phone', playing: true });
  });

  it("names the app when the phone gives no title", () => {
    expect(nowPlaying(phone({ title: undefined, artist: 'Podcast host' }), radio('idle'))).toMatchObject({ title: 'Spotify', subtitle: 'Podcast host · Spotify' });
  });
});

import { useSyncExternalStore } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { device, NO_PHONE_MEDIA, type MediaAction, type PhoneMedia } from './device';
import { radio, type RadioState, type RadioStation } from './radio';

/**
 * What plays on the ride, wherever from: the phone's music apps or RIDECORE's radio. One
 * at a time: starting one pauses the other.
 */
export interface NowPlaying {
  source: 'phone' | 'radio';
  title: string;
  /** Artist and app, or what the station plays. */
  subtitle?: string;
  art?: string;
  playing: boolean;
  /** The radio finding its stream. */
  loading?: boolean;
  error?: string;
}

export type MediaSource = NowPlaying['source'];

/**
 * The one to show: the radio while it plays or loads; else the phone's while it plays;
 * with both paused, the one used last, so play picks up where the rider left off; else
 * whichever there is.
 */
export function nowPlaying(phone: PhoneMedia, radioState: RadioState, last: MediaSource = 'phone'): NowPlaying | null {
  const station = radioState.station;
  const radioOn = radioState.status === 'playing' || radioState.status === 'loading';
  const fromRadio = (): NowPlaying | null =>
    station
      ? {
          source: 'radio',
          title: station.name,
          subtitle: station.tags ? `Radio · ${station.tags}` : 'Radio',
          art: station.favicon,
          playing: radioState.status === 'playing',
          loading: radioState.status === 'loading',
          error: radioState.error,
        }
      : null;
  if (radioOn) return fromRadio();
  const phoneShown = phone.active && Boolean(phone.title || phone.artist);
  if (phoneShown && !phone.playing && last === 'radio' && station) return fromRadio();
  if (phoneShown) {
    return {
      source: 'phone',
      title: phone.title ?? phone.app ?? 'Playing',
      subtitle: [phone.artist, phone.app].filter(Boolean).join(' · ') || undefined,
      art: phone.art,
      playing: phone.playing,
    };
  }
  return fromRadio();
}

// The phone's media, followed for as long as RIDECORE runs, and which was used last.
let phone: PhoneMedia = NO_PHONE_MEDIA;
let last: MediaSource = 'phone';
const phoneListeners = new Set<() => void>();

function changed(): void {
  for (const listener of phoneListeners) listener();
}

function setLast(source: MediaSource): void {
  if (last === source) return;
  last = source;
  changed();
}

function setPhone(next: PhoneMedia): void {
  // The phone started playing (from its own app, a headset): the radio gives way.
  if (next.playing && !phone.playing) {
    last = 'phone';
    const status = radio.getState().status;
    if (status === 'playing' || status === 'loading') radio.pause();
  }
  phone = next;
  changed();
}

/** Starts following the phone's music; the returned function stops it. */
export function followMedia(): () => void {
  const read = () => void device.getMedia().then(setPhone, () => setPhone(NO_PHONE_MEDIA));
  read();
  const changes = device.addListener('media', setPhone);
  const resume = CapacitorApp.addListener('resume', read);
  return () => {
    void changes.then((l) => l.remove());
    void resume.then((l) => l.remove());
  };
}

const subscribePhone = (listener: () => void) => {
  phoneListeners.add(listener);
  return () => phoneListeners.delete(listener);
};
const getPhone = () => phone;
const getLast = () => last;

export function usePhoneMedia(): PhoneMedia {
  return useSyncExternalStore(subscribePhone, getPhone);
}

export function useRadio(): RadioState {
  return useSyncExternalStore(radio.subscribe, radio.getState);
}

export function useNowPlaying(): NowPlaying | null {
  const lastUsed = useSyncExternalStore(subscribePhone, getLast);
  return nowPlaying(usePhoneMedia(), useRadio(), lastUsed);
}

/** The stations next and back step through: the list the playing one was picked from. */
let queue: RadioStation[] = [];

/** Plays a station, the phone's music paused for it. */
export function playStation(station: RadioStation, from: RadioStation[] = []): void {
  queue = from;
  setLast('radio');
  if (phone.playing) void device.mediaControl({ action: 'pause' }).catch(() => undefined);
  radio.play(station);
}

function stepStation(by: number): void {
  const current = radio.getState().station;
  if (!current || queue.length < 2) return;
  const at = queue.findIndex((s) => s.id === current.id);
  const next = queue[(at + by + queue.length) % queue.length];
  if (next) radio.play(next);
}

function phoneControl(action: MediaAction): void {
  setLast('phone');
  // Music from the phone starting: the radio stops for it.
  if (action === 'play' || (action === 'toggle' && !phone.playing)) radio.pause();
  void device.mediaControl({ action }).catch(() => undefined);
}

/** Play or pause whatever is showing; with nothing showing, the phone's last music. */
export function togglePlay(now: NowPlaying | null): void {
  if (now?.source === 'radio') {
    if (!now.playing && !now.loading && phone.playing) void device.mediaControl({ action: 'pause' }).catch(() => undefined);
    radio.toggle();
  } else phoneControl('toggle');
}

export function skip(now: NowPlaying | null, direction: 'next' | 'previous'): void {
  if (now?.source === 'radio') stepStation(direction === 'next' ? 1 : -1);
  else phoneControl(direction);
}

/** Next and back do something: the phone's always try; the radio's need a list to step through. */
export function canSkip(now: NowPlaying | null): boolean {
  return now?.source !== 'radio' || queue.length > 1;
}

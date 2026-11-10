import { describe, expect, it } from 'vitest';
import { availableFaces, nextFace, shownFace, takeover, type FaceSignals } from './faces';

const none: FaceSignals = { trip: false, ride: false, music: false, musicPlaying: false, lean: false, weather: false };
const signals = (on: Partial<FaceSignals>): FaceSignals => ({ ...none, ...on });

describe('the dash dial faces', () => {
  it('always has the time, and the rest in order when there', () => {
    expect(availableFaces(none)).toEqual(['clock']);
    expect(availableFaces(signals({ weather: true, music: true, trip: true }))).toEqual(['trip', 'music', 'weather', 'clock']);
    expect(availableFaces(signals({ lean: true, music: true }))).toEqual(['music', 'lean', 'clock']);
  });

  it('shows the face picked while it is there, else the first', () => {
    const faces = availableFaces(signals({ music: true, weather: true }));
    expect(shownFace(faces, 'weather')).toBe('weather');
    expect(shownFace(faces, null)).toBe('music');
    // Picked the trip, and the trip ended.
    expect(shownFace(faces, 'trip')).toBe('music');
  });

  it('steps through the faces there are, round to the first', () => {
    const faces = availableFaces(signals({ music: true, weather: true }));
    expect(nextFace(faces, 'music')).toBe('weather');
    expect(nextFace(faces, 'weather')).toBe('clock');
    expect(nextFace(faces, 'clock')).toBe('music');
    expect(nextFace(['clock'], 'clock')).toBe('clock');
  });

  it('shows a trip as it starts, whatever else is on', () => {
    expect(takeover(signals({ musicPlaying: true, music: true }), signals({ trip: true, musicPlaying: true, music: true }))).toBe('trip');
  });

  it('shows music or a ride as it starts, unless a trip is under way', () => {
    expect(takeover(none, signals({ music: true, musicPlaying: true }))).toBe('music');
    expect(takeover(none, signals({ ride: true }))).toBe('ride');
    expect(takeover(signals({ trip: true }), signals({ trip: true, music: true, musicPlaying: true }))).toBeNull();
    expect(takeover(signals({ trip: true }), signals({ trip: true, ride: true }))).toBeNull();
  });

  it('leaves the face alone when nothing starts', () => {
    const playing = signals({ music: true, musicPlaying: true, weather: true });
    expect(takeover(playing, playing)).toBeNull();
    // Paused, or the weather coming in, doesn't take the dial.
    expect(takeover(playing, signals({ music: true, weather: true }))).toBeNull();
    expect(takeover(none, signals({ weather: true }))).toBeNull();
    // Plugging in the module offers the lean, but doesn't take the dial.
    expect(takeover(none, signals({ lean: true }))).toBeNull();
  });
});

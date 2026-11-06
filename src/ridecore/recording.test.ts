import { describe, expect, it } from 'vitest';
import type { LiveRide } from './engine';
import { averageKmh, recorderLine, recorderNote, rideTotals, topKmh } from './recording';

const ride = (patch: Partial<LiveRide> = {}): LiveRide => ({
  id: 'r1',
  state: 'recording',
  startedAt: 0,
  distanceMeters: 0,
  auto: false,
  ...patch,
});

describe('recorderLine', () => {
  it('says recording, red, and whether navigation started it', () => {
    expect(recorderLine(ride(), false)).toEqual({ text: 'Recording', live: true });
    expect(recorderLine(ride({ auto: true }), false)).toEqual({ text: 'Recording with navigation', live: true });
  });

  it('says paused', () => {
    expect(recorderLine(ride({ state: 'paused' }), true)).toEqual({ text: 'Paused', live: false });
  });

  it('says whether trips record themselves when nothing is recording', () => {
    expect(recorderLine(null, true).text).toBe('Auto-record on');
    expect(recorderLine(null, false).text).toBe('Not recording');
  });
});

describe('recorderNote', () => {
  it('tells how a ride ends while it records', () => {
    expect(recorderNote(ride())).toBe('Pause to save or discard');
    expect(recorderNote(ride({ auto: true }))).toBe('Saves itself when the trip ends');
  });

  it('says nothing when paused or idle: the keys are there', () => {
    expect(recorderNote(ride({ state: 'paused' }))).toBeNull();
    expect(recorderNote(null)).toBeNull();
  });
});

describe('averageKmh', () => {
  it('is distance over the time recorded', () => {
    expect(averageKmh(30_000, 3600)).toBe(30);
    expect(averageKmh(1000, 60)).toBe(60);
  });

  it('waits for enough time and distance', () => {
    expect(averageKmh(5000, 20)).toBeNull();
    expect(averageKmh(50, 600)).toBeNull();
    expect(averageKmh(Number.NaN, 600)).toBeNull();
  });
});

describe('rideTotals', () => {
  it('adds the rides up', () => {
    expect(rideTotals([{ distanceMeters: 12_000 }, { distanceMeters: 3500 }])).toEqual({ count: 2, meters: 15_500 });
    expect(rideTotals([])).toEqual({ count: 0, meters: 0 });
  });

  it('ignores a broken distance', () => {
    expect(rideTotals([{ distanceMeters: -5 }, { distanceMeters: 1000 }])).toEqual({ count: 2, meters: 1000 });
  });
});

describe('topKmh', () => {
  it('is the top speed in km/h, or nothing without one', () => {
    expect(topKmh({ maxSpeedMps: 25 })).toBe(90);
    expect(topKmh({ maxSpeedMps: 0 })).toBeNull();
  });
});

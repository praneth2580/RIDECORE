import { afterEach, describe, expect, it } from 'vitest';
import { navigationZoomForSpeed as fullScreenZoom } from '../services/nav-display';
import {
  FARTHEST_ZOOM,
  getZoomMultiplier,
  navigationZoomForSpeed,
  riderHeadingDegrees,
  setZoomMultiplier,
  ZOOM_OUT,
} from './overrides/services/nav-display';

const kmh = (speed: number) => speed / 3.6;

describe("RIDECORE's zoom by speed", () => {
  afterEach(() => setZoomMultiplier(1));

  it("is TrailCompass's, pulled back for the smaller map", () => {
    expect(getZoomMultiplier()).toBe(1);
    for (const speed of [0, 15, 40, 70, 100, 150]) {
      expect(navigationZoomForSpeed(kmh(speed))).toBeCloseTo(fullScreenZoom(kmh(speed)) - ZOOM_OUT);
    }
  });

  it('still shows more road the faster the ride', () => {
    expect(navigationZoomForSpeed(kmh(90))).toBeLessThan(navigationZoomForSpeed(kmh(30)));
  });

  it('zooms out by the multiplier, the same when standing still', () => {
    const still = navigationZoomForSpeed(0);
    const atNormal = still - navigationZoomForSpeed(kmh(100));
    setZoomMultiplier(0.5);
    expect(navigationZoomForSpeed(0)).toBeCloseTo(still);
    expect(still - navigationZoomForSpeed(kmh(100))).toBeCloseTo(atNormal * 0.5);
    setZoomMultiplier(1.5);
    expect(navigationZoomForSpeed(0)).toBeCloseTo(still);
    expect(still - navigationZoomForSpeed(kmh(100))).toBeCloseTo(atNormal * 1.5);
  });

  it('never goes further out than the farthest zoom', () => {
    setZoomMultiplier(40);
    expect(navigationZoomForSpeed(kmh(150))).toBe(FARTHEST_ZOOM);
  });

  it('ignores a multiplier that is no number', () => {
    setZoomMultiplier(Number.NaN);
    setZoomMultiplier(-1);
    expect(getZoomMultiplier()).toBe(1);
  });

  it("keeps the rest of TrailCompass's maths", () => {
    expect(riderHeadingDegrees({ courseDegrees: 90, speedMps: 10 })).toBe(90);
  });
});

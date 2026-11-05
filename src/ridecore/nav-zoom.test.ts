import { describe, expect, it } from 'vitest';
import { navigationZoomForSpeed as fullScreenZoom } from '../services/nav-display';
import { navigationZoomForSpeed, riderHeadingDegrees, ZOOM_OUT } from './overrides/services/nav-display';

describe("RIDECORE's navigation zoom", () => {
  it("is TrailCompass's, pulled back for the smaller map", () => {
    for (const kmh of [0, 15, 40, 70, 100, 150]) {
      expect(navigationZoomForSpeed(kmh / 3.6)).toBeCloseTo(fullScreenZoom(kmh / 3.6) - ZOOM_OUT);
    }
  });

  it('still shows more road the faster the ride', () => {
    expect(navigationZoomForSpeed(90 / 3.6)).toBeLessThan(navigationZoomForSpeed(30 / 3.6));
  });

  it("keeps the rest of TrailCompass's maths", () => {
    expect(riderHeadingDegrees({ courseDegrees: 90, speedMps: 10 })).toBe(90);
  });
});

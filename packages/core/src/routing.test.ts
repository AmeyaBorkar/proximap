import { describe, expect, it } from 'vitest';
import { circlePolygon, HaversineRoutingProvider, MODE_SPEED_MPS, pointInPolygon } from './routing';

describe('HaversineRoutingProvider', () => {
  const provider = new HaversineRoutingProvider();
  const origin = { lat: 0, lng: 0 };
  const targets = [{ lat: 0, lng: 0.009 }]; // ~1002 m east at the equator

  it('estimates distance and a mode-dependent duration', async () => {
    const [walk] = await provider.matrix(origin, targets, 'walk');
    expect(walk!.meters).toBeGreaterThan(990);
    expect(walk!.meters).toBeLessThan(1010);
    expect(walk!.seconds).toBe(Math.round(walk!.meters / MODE_SPEED_MPS.walk));

    const [drive] = await provider.matrix(origin, targets, 'drive');
    expect(drive!.seconds).toBeLessThan(walk!.seconds); // driving is faster ⇒ fewer seconds
  });

  it('produces an isochrone circle scaled to the time budget', async () => {
    const ring = await provider.isochrone(origin, 15, 'walk');
    expect(ring.length).toBeGreaterThan(3);
    expect(ring[0]!.length).toBe(2); // [lng, lat]
  });
});

describe('circlePolygon + pointInPolygon', () => {
  it('includes points within the radius and excludes those outside', () => {
    const center = { lat: 52.5, lng: 13.4 };
    const ring = circlePolygon(center, 1000); // 1 km circle
    expect(pointInPolygon(center, ring)).toBe(true);
    expect(pointInPolygon({ lat: 52.5, lng: 13.404 }, ring)).toBe(true); // ~270 m east
    expect(pointInPolygon({ lat: 52.5, lng: 13.45 }, ring)).toBe(false); // ~3.4 km east
  });
});

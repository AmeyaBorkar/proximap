import { describe, expect, it } from 'vitest';
import { haversineMeters } from './geo';
import { reachableAmenities } from './reachable';
import type { PolygonRing, RoutingProvider } from './routing';
import type { GeocodingProvider, LatLng, PlacesProvider, Poi } from './types';

const geocoder: GeocodingProvider = {
  name: 'fake',
  async geocode() {
    return [{ name: 'O', displayName: 'Origin', location: { lat: 0, lng: 0 }, source: 'fake' }];
  },
};

// A is ~111 m east, B is ~1113 m east of the origin.
const places: PlacesProvider = {
  name: 'fake',
  async findNearby() {
    const pois: Poi[] = [
      {
        id: 'node/a',
        category: 'food',
        location: { lat: 0, lng: 0.001 },
        tags: { amenity: 'cafe' },
        source: 'fake',
      },
      {
        id: 'node/b',
        category: 'food',
        location: { lat: 0, lng: 0.01 },
        tags: { amenity: 'cafe' },
        source: 'fake',
      },
    ];
    return pois;
  },
};

const matrixByDistance = async (origin: LatLng, targets: readonly LatLng[]) =>
  targets.map((target) => {
    const meters = haversineMeters(origin, target);
    return { meters: Math.round(meters), seconds: Math.round(meters / 1.4) };
  });

describe('reachableAmenities', () => {
  it('uses the isochrone polygon for membership when available', async () => {
    // A ±0.003° (~333 m) box around the origin: A is inside, B is well outside.
    const box: PolygonRing = [
      [-0.003, -0.003],
      [0.003, -0.003],
      [0.003, 0.003],
      [-0.003, 0.003],
      [-0.003, -0.003],
    ];
    const routing: RoutingProvider = {
      name: 'iso',
      matrix: matrixByDistance,
      async isochrone() {
        return box;
      },
    };

    const result = await reachableAmenities('here', {
      within: 10,
      geocoder,
      places,
      routing,
    });
    expect(result.isochrone).not.toBeNull();
    expect(result.results.map((r) => r.id)).toEqual(['node/a']);
    expect(result.results[0]!.travelSeconds).toBeGreaterThan(0);
  });

  it('falls back to a travel-time threshold when no isochrone is available', async () => {
    const routing: RoutingProvider = { name: 'matrix-only', matrix: matrixByDistance };
    // Budget 10 min ⇒ 600 s. A ≈ 79 s (in), B ≈ 795 s (out).
    const result = await reachableAmenities('here', {
      within: 10,
      geocoder,
      places,
      routing,
    });
    expect(result.isochrone).toBeNull();
    expect(result.results.map((r) => r.id)).toEqual(['node/a']);
  });

  it('requires a positive time budget', async () => {
    await expect(reachableAmenities('here', { within: 0, geocoder, places })).rejects.toThrow(
      /positive/,
    );
  });
});

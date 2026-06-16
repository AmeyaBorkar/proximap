import { describe, expect, it } from 'vitest';
import { findNearbyAmenities } from './nearby';
import type { GeocodingProvider, PlacesProvider, Poi } from './types';

const geocoder: GeocodingProvider = {
  name: 'fake-geocoder',
  async geocode() {
    return [
      {
        name: 'Origin',
        displayName: 'Origin City, Country',
        location: { lat: 0, lng: 0 },
        source: 'fake-geocoder',
      },
    ];
  },
};

const places: PlacesProvider = {
  name: 'fake-places',
  async findNearby() {
    const pois: Poi[] = [
      {
        id: 'node/2',
        name: 'Far Cafe',
        category: 'food',
        location: { lat: 0, lng: 0.002 },
        tags: {},
        source: 'fake-places',
      },
      {
        id: 'node/1',
        name: 'Near Shop',
        category: 'shopping',
        location: { lat: 0, lng: 0.001 },
        tags: {},
        source: 'fake-places',
      },
    ];
    return pois;
  },
};

describe('findNearbyAmenities', () => {
  it('geocodes the query, ranks by distance, and applies the limit', async () => {
    const { origin, results, total } = await findNearbyAmenities('somewhere', {
      geocoder,
      places,
      radiusMeters: 1000,
      limit: 1,
    });

    expect(origin.displayName).toBe('Origin City, Country');
    expect(total).toBe(2);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 'node/1', rank: 1 });
  });

  it('accepts a "lat,lng" string and falls back to raw coordinates', async () => {
    const { origin, results } = await findNearbyAmenities('0,0', { geocoder, places });
    expect(origin.source).toBe('coordinates');
    expect(origin.location).toEqual({ lat: 0, lng: 0 });
    expect(results.map((r) => r.id)).toEqual(['node/1', 'node/2']);
  });

  it('throws when the query cannot be geocoded', async () => {
    const empty: GeocodingProvider = {
      name: 'empty',
      async geocode() {
        return [];
      },
    };
    await expect(findNearbyAmenities('nowhere', { geocoder: empty, places })).rejects.toThrow(
      /No location found/,
    );
  });
});

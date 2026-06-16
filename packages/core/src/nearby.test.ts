import { describe, expect, it } from 'vitest';
import { findNearbyAmenities } from './nearby';
import type { RoutingProvider } from './routing';
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

const tagged: PlacesProvider = {
  name: 'tagged',
  async findNearby() {
    const pois: Poi[] = [
      {
        id: 'node/1',
        name: 'Bean There',
        category: 'food',
        kind: 'cafe',
        location: { lat: 0, lng: 0.001 },
        tags: { amenity: 'cafe' },
        source: 'tagged',
      },
      {
        id: 'node/2',
        name: 'Bank X',
        category: 'finance',
        kind: 'bank',
        location: { lat: 0, lng: 0.0005 },
        tags: { amenity: 'bank' },
        source: 'tagged',
      },
    ];
    return pois;
  },
};

describe('findNearbyAmenities — natural-language categories', () => {
  it('resolves a term and keeps only matching POIs', async () => {
    const { results } = await findNearbyAmenities('somewhere', {
      geocoder,
      places: tagged,
      categories: ['coffee'],
      radiusMeters: 1000,
    });
    expect(results.map((r) => r.id)).toEqual(['node/1']);
  });

  it('throws with suggestions on an unknown category', async () => {
    await expect(
      findNearbyAmenities('somewhere', { geocoder, places: tagged, categories: ['coffe'] }),
    ).rejects.toThrow(/Unknown category.*coffee/);
  });
});

const withHours: PlacesProvider = {
  name: 'with-hours',
  async findNearby() {
    const pois: Poi[] = [
      {
        id: 'open',
        name: 'Open Cafe',
        category: 'food',
        location: { lat: 0, lng: 0.001 },
        tags: { amenity: 'cafe', opening_hours: 'Mo-Fr 09:00-17:00' },
        source: 'with-hours',
      },
      {
        id: 'closed',
        name: 'Evening Bar',
        category: 'food',
        location: { lat: 0, lng: 0.0005 },
        tags: { amenity: 'bar', opening_hours: 'Mo-Fr 18:00-23:00' },
        source: 'with-hours',
      },
      {
        id: 'mystery',
        name: 'Mystery Diner',
        category: 'food',
        location: { lat: 0, lng: 0.0015 },
        tags: { amenity: 'restaurant', opening_hours: 'sunrise-sunset' },
        source: 'with-hours',
      },
      {
        id: 'untagged',
        name: 'No Hours Kiosk',
        category: 'food',
        location: { lat: 0, lng: 0.002 },
        tags: { amenity: 'fast_food' },
        source: 'with-hours',
      },
    ];
    return pois;
  },
};

describe('findNearbyAmenities — travel-time ranking', () => {
  // Candidates arrive nearest-first; give the nearest the longest time so a
  // correct travel-time sort reverses the straight-line order.
  const reverseRouter: RoutingProvider = {
    name: 'reverse',
    async matrix(_origin, targets) {
      return targets.map((_t, index) => ({ seconds: (targets.length - index) * 60, meters: 100 }));
    },
  };

  it('reorders results by travel time and annotates each result', async () => {
    const { results, routing } = await findNearbyAmenities('somewhere', {
      geocoder,
      places, // node/1 is nearer than node/2
      rankBy: 'travelTime',
      routing: reverseRouter,
    });
    expect(results.map((r) => r.id)).toEqual(['node/2', 'node/1']); // reversed vs distance
    expect(results[0]!.travelSeconds).toBe(60);
    expect(results[0]!.rank).toBe(1);
    expect(routing).toEqual({ provider: 'reverse', mode: 'walk', fellBack: false });
  });

  it('falls back to haversine when the routing engine errors', async () => {
    const broken: RoutingProvider = {
      name: 'broken',
      async matrix() {
        throw new Error('engine down');
      },
    };
    const { results, routing } = await findNearbyAmenities('somewhere', {
      geocoder,
      places,
      rankBy: 'travelTime',
      mode: 'bike',
      routing: broken,
    });
    expect(routing).toEqual({ provider: 'haversine', mode: 'bike', fellBack: true });
    expect(results[0]!.travelSeconds).toBeGreaterThan(0); // haversine still produced times
  });
});

describe('findNearbyAmenities — open-now / open-at', () => {
  // 2026-01-05 is a Monday; 10:00 falls inside 09:00-17:00.
  const at = '2026-01-05T10:00:00';

  it('drops confirmed-closed places but keeps open and unknown ones', async () => {
    const { results } = await findNearbyAmenities('somewhere', {
      geocoder,
      places: withHours,
      open: { at },
      radiusMeters: 1000,
    });
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain('closed');
    expect(ids).toEqual(expect.arrayContaining(['open', 'mystery', 'untagged']));
  });

  it('annotates results with openState and a next-change time', async () => {
    const { results } = await findNearbyAmenities('somewhere', {
      geocoder,
      places: withHours,
      open: { at },
      radiusMeters: 1000,
    });
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    expect(byId.open!.openState).toBe('open');
    expect(new Date(byId.open!.nextChange!).getHours()).toBe(17); // closes at 17:00
    expect(byId.mystery!.openState).toBe('unknown');
    expect(byId.untagged!.openState).toBe('unknown');
  });
});

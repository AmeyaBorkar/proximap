import { describe, expect, it } from 'vitest';
import { compareLocations } from './compare';
import type { GeocodingProvider, LatLng, PlacesProvider, Poi } from './types';

// alpha sits at {0,0}, beta at {0,1}; each has one need close and the other far.
const geocoder: GeocodingProvider = {
  name: 'fake',
  async geocode(query: string) {
    const coords: Record<string, LatLng> = { alpha: { lat: 0, lng: 0 }, beta: { lat: 0, lng: 1 } };
    const location = coords[query] ?? { lat: 0, lng: 0 };
    return [{ name: query, displayName: `${query} city`, location, source: 'fake' }];
  },
};

const poi = (
  id: string,
  category: Poi['category'],
  lng: number,
  tags: Record<string, string>,
): Poi => ({
  id,
  category,
  location: { lat: 0, lng },
  tags,
  source: 'fake',
});

const places: PlacesProvider = {
  name: 'fake',
  async findNearby(center: LatLng) {
    // ~0.00045° ≈ 50 m; ~0.018° ≈ 2004 m at the equator.
    if (Math.round(center.lng) === 0) {
      return [
        poi('a-grocery', 'grocery', 0.00045, { shop: 'supermarket' }), // 50 m
        poi('a-food', 'food', 0.018, { amenity: 'cafe' }), // 2004 m
      ];
    }
    return [
      poi('b-grocery', 'grocery', 1.018, { shop: 'supermarket' }), // 2004 m
      poi('b-food', 'food', 1.00045, { amenity: 'cafe' }), // 50 m
    ];
  },
};

describe('compareLocations', () => {
  it('ranks locations and names a per-dimension winner', async () => {
    const report = await compareLocations(['alpha', 'beta'], {
      geocoder,
      places,
      categories: [
        { term: 'grocery', weight: 3 },
        { term: 'food', weight: 1 },
      ],
    });

    // grocery-heavy weights ⇒ alpha (close grocery) wins.
    expect(report.locations[0]!.score).toBe(80);
    expect(report.locations[1]!.score).toBe(40);
    expect(report.ranked[0]!.index).toBe(0);
    expect(report.best!.index).toBe(0);

    const byCategory = Object.fromEntries(report.dimensions.map((d) => [d.category, d]));
    expect(byCategory.grocery!.bestIndex).toBe(0); // alpha
    expect(byCategory.food!.bestIndex).toBe(1); // beta
  });

  it('lets the weights change the ranking', async () => {
    const report = await compareLocations(['alpha', 'beta'], {
      geocoder,
      places,
      categories: [
        { term: 'grocery', weight: 1 },
        { term: 'food', weight: 3 },
      ],
    });
    // food-heavy weights ⇒ beta (close food) now wins.
    expect(report.ranked[0]!.index).toBe(1);
    expect(report.ranked[0]!.score).toBe(80);
    expect(report.locations[0]!.score).toBe(40);
  });

  it('requires at least two locations', async () => {
    await expect(compareLocations(['alpha'], { geocoder, places })).rejects.toThrow(/at least two/);
  });
});

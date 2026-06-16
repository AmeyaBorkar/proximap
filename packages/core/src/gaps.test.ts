import { describe, expect, it } from 'vitest';
import { detectGaps } from './gaps';
import type { GeocodingProvider, PlacesProvider, Poi } from './types';

const geocoder: GeocodingProvider = {
  name: 'fake',
  async geocode() {
    return [{ name: 'O', displayName: 'Origin', location: { lat: 0, lng: 0 }, source: 'fake' }];
  },
};

const places: PlacesProvider = {
  name: 'fake',
  async findNearby() {
    const pois: Poi[] = [
      {
        id: 'node/1',
        category: 'grocery',
        kind: 'supermarket',
        location: { lat: 0, lng: 0.001 }, // ~111 m
        tags: { shop: 'supermarket' },
        source: 'fake',
        completeness: 0.5,
      },
      {
        id: 'node/2',
        category: 'food',
        kind: 'cafe',
        location: { lat: 0, lng: 0.02 }, // ~2.2 km
        tags: { amenity: 'cafe' },
        source: 'fake',
      },
    ];
    return pois;
  },
};

describe('detectGaps', () => {
  it('flags categories with no match or beyond the threshold', async () => {
    const report = await detectGaps('here', {
      geocoder,
      places,
      categories: ['grocery', 'food', 'pharmacy'],
      searchRadiusMeters: 5000,
      thresholdMeters: 1000,
    });

    const byCategory = Object.fromEntries(report.gaps.map((gap) => [gap.category, gap]));
    expect(byCategory.grocery!.isGap).toBe(false);
    expect(byCategory.grocery!.nearestMeters).toBeGreaterThan(0);
    expect(byCategory.grocery!.nearestMeters).toBeLessThan(200);
    expect(byCategory.grocery!.nearestCompleteness).toBe(0.5);
    expect(byCategory.food!.isGap).toBe(true); // ~2.2 km > 1 km threshold
    expect(byCategory.pharmacy!.nearestMeters).toBeNull();
    expect(byCategory.pharmacy!.isGap).toBe(true);
    expect(report.missing).toEqual(['food', 'pharmacy']);
  });

  it('throws with suggestions on an unknown category', async () => {
    await expect(detectGaps('here', { geocoder, places, categories: ['pharmcy'] })).rejects.toThrow(
      /Unknown category.*pharmacy/,
    );
  });

  it('uses sensible daily-need defaults', async () => {
    const report = await detectGaps('here', { geocoder, places });
    expect(report.gaps.length).toBeGreaterThanOrEqual(6);
    expect(report.gaps.some((gap) => gap.category === 'grocery')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { planErrands } from './errands';
import type { GeocodingProvider, PlacesProvider, Poi } from './types';

const geocoder: GeocodingProvider = {
  name: 'fake',
  async geocode() {
    return [{ name: 'Home', displayName: 'Home', location: { lat: 0, lng: 0 }, source: 'fake' }];
  },
};

// Origin at (0,0). The NEAREST pharmacy (ph1, 223 m north) is a detour away from
// the lone ATM (east); the farther pharmacy (ph2, near the ATM) gives a shorter
// total trip — so greedy-nearest-per-category is wrong and the DP must win.
const places: PlacesProvider = {
  name: 'fake',
  async findNearby() {
    const pois: Poi[] = [
      {
        id: 'ph1',
        category: 'healthcare',
        kind: 'pharmacy',
        location: { lat: 0.002, lng: 0 },
        tags: { amenity: 'pharmacy' },
        source: 'fake',
      },
      {
        id: 'ph2',
        category: 'healthcare',
        kind: 'pharmacy',
        location: { lat: 0, lng: 0.018 },
        tags: { amenity: 'pharmacy' },
        source: 'fake',
      },
      {
        id: 'atm1',
        category: 'finance',
        kind: 'atm',
        location: { lat: 0, lng: 0.02 },
        tags: { amenity: 'atm' },
        source: 'fake',
      },
    ];
    return pois;
  },
};

describe('planErrands', () => {
  it('chooses one POI per category and the optimal order (beats greedy-nearest)', async () => {
    const plan = await planErrands('home', {
      categories: ['pharmacy', 'atm'],
      geocoder,
      places,
    });

    expect(plan.stops).toHaveLength(2);
    // The DP picks the farther pharmacy (ph2) because it is next to the ATM.
    expect(plan.stops[0]!.poi.id).toBe('ph2');
    expect(plan.stops[1]!.poi.id).toBe('atm1');
    expect(plan.stops.map((s) => s.category)).toEqual(['pharmacy', 'atm']);
    // O→ph2 (~2004 m) + ph2→atm (~223 m) ≈ 2226 m, well under the greedy ~2460 m.
    expect(plan.totalMeters).toBeGreaterThan(2150);
    expect(plan.totalMeters).toBeLessThan(2300);
    expect(plan.missing).toEqual([]);
  });

  it('reports categories with no candidate as missing, never faked', async () => {
    const plan = await planErrands('home', {
      categories: ['pharmacy', 'fuel'],
      geocoder,
      places,
    });
    expect(plan.missing).toEqual(['fuel']);
    expect(plan.stops.map((s) => s.category)).toEqual(['pharmacy']);
  });

  it('throws on an unknown category with suggestions', async () => {
    await expect(
      planErrands('home', { categories: ['pharmcy'], geocoder, places }),
    ).rejects.toThrow(/Unknown category.*pharmacy/);
  });

  it('requires at least one category', async () => {
    await expect(planErrands('home', { categories: [], geocoder, places })).rejects.toThrow(
      /at least one category/,
    );
  });
});

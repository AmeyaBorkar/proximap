import { describe, expect, it } from 'vitest';
import type { GeocodingProvider, PlacesProvider, Poi } from './types';
import { walkabilityScore, walkSubScore } from './walkability';

const geocoder: GeocodingProvider = {
  name: 'fake',
  async geocode() {
    return [{ name: 'O', displayName: 'Origin', location: { lat: 0, lng: 0 }, source: 'fake' }];
  },
};

// At the equator, 1° of longitude ≈ 111_320 m, so these sit at predictable
// distances east of the origin: 0.001 ≈ 111 m, 0.005 ≈ 557 m, 0.02 ≈ 2226 m.
const places: PlacesProvider = {
  name: 'fake',
  async findNearby() {
    const pois: Poi[] = [
      {
        id: 'node/1',
        category: 'grocery',
        kind: 'supermarket',
        location: { lat: 0, lng: 0.001 },
        tags: { shop: 'supermarket' },
        source: 'fake',
        completeness: 0.6,
      },
      {
        id: 'node/2',
        category: 'food',
        kind: 'cafe',
        location: { lat: 0, lng: 0.005 },
        tags: { amenity: 'cafe' },
        source: 'fake',
      },
      {
        id: 'node/3',
        category: 'healthcare',
        kind: 'pharmacy',
        location: { lat: 0, lng: 0.02 },
        tags: { amenity: 'pharmacy' },
        source: 'fake',
      },
    ];
    return pois;
  },
};

const categories = [
  { term: 'grocery', weight: 3 },
  { term: 'food', weight: 2 },
  { term: 'pharmacy', weight: 2 },
  { term: 'transport', weight: 1 },
];

describe('walkSubScore', () => {
  it('gives full credit within ideal, zero past max, linear in between', () => {
    expect(walkSubScore(0, 400, 2400)).toBe(1);
    expect(walkSubScore(400, 400, 2400)).toBe(1);
    expect(walkSubScore(2400, 400, 2400)).toBe(0);
    expect(walkSubScore(3000, 400, 2400)).toBe(0);
    expect(walkSubScore(1400, 400, 2400)).toBe(0.5); // midpoint
    expect(walkSubScore(null, 400, 2400)).toBe(0);
  });
});

describe('walkabilityScore', () => {
  it('produces a deterministic score and per-category breakdown', async () => {
    const report = await walkabilityScore('here', { geocoder, places, categories });

    const by = Object.fromEntries(report.breakdown.map((b) => [b.category, b]));
    expect(by.grocery!.subScore).toBe(1); // ~111 m, within ideal
    expect(by.grocery!.nearestMeters).toBeLessThan(200);
    expect(by.grocery!.nearestCompleteness).toBe(0.6);
    expect(by.food!.subScore).toBe(0.92); // ~557 m → (2400-557)/2000
    expect(by.pharmacy!.subScore).toBe(0.09); // ~2226 m, near the far edge
    expect(by.transport!.subScore).toBe(0); // none found
    expect(by.transport!.nearestMeters).toBeNull();

    // weighted: (3*1 + 2*0.92 + 2*0.09 + 1*0) / 8 = 0.6275 → 63
    expect(report.score).toBe(63);
    expect(report.missing).toEqual(['transport']);
    expect(report.decay).toEqual({ idealMeters: 400, maxMeters: 2400 });
  });

  it('lowers confidence when categories are missing or sparsely tagged', async () => {
    const report = await walkabilityScore('here', { geocoder, places, categories });
    expect(report.confidence).toBeGreaterThan(0);
    expect(report.confidence).toBeLessThan(1); // transport missing ⇒ not full confidence
  });

  it('honours tunable decay bounds', async () => {
    const report = await walkabilityScore('here', {
      geocoder,
      places,
      categories,
      decay: { idealMeters: 100, maxMeters: 200 },
    });
    const by = Object.fromEntries(report.breakdown.map((b) => [b.category, b]));
    expect(by.grocery!.subScore).toBe(0.89); // ~111 m → (200-111)/100
    expect(by.food!.subScore).toBe(0); // ~557 m, past max
  });

  it('throws with suggestions on an unknown category', async () => {
    await expect(
      walkabilityScore('here', { geocoder, places, categories: [{ term: 'pharmcy', weight: 1 }] }),
    ).rejects.toThrow(/Unknown category.*pharmacy/);
  });

  it('uses sensible daily-need defaults', async () => {
    const report = await walkabilityScore('here', { geocoder, places });
    expect(report.breakdown.length).toBeGreaterThanOrEqual(8);
    expect(report.breakdown.some((b) => b.category === 'grocery')).toBe(true);
  });
});

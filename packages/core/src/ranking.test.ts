import { describe, expect, it } from 'vitest';
import { rankByProximity } from './ranking';
import type { Category, Poi } from './types';

const origin = { lat: 0, lng: 0 };

function poi(id: string, lng: number, category: Category): Poi {
  return { id, name: id, category, location: { lat: 0, lng }, tags: {}, source: 'test' };
}

describe('rankByProximity', () => {
  it('orders nearest first and assigns ranks', () => {
    const ranked = rankByProximity(origin, [poi('far', 0.002, 'food'), poi('near', 0.001, 'food')]);
    expect(ranked.map((r) => r.id)).toEqual(['near', 'far']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2]);
    expect(ranked[0]!.distanceMeters).toBeLessThan(ranked[1]!.distanceMeters);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it('returns an empty array for no input', () => {
    expect(rankByProximity(origin, [])).toEqual([]);
  });

  it('lets category weights outrank pure distance', () => {
    const cafe = poi('cafe', 0.001, 'food'); // ~111 m
    const hospital = poi('hospital', 0.0015, 'healthcare'); // ~167 m
    const ranked = rankByProximity(origin, [cafe, hospital], {
      radiusMeters: 1000,
      categoryWeights: { healthcare: 2 },
    });
    expect(ranked.map((r) => r.id)).toEqual(['hospital', 'cafe']);
  });

  it('breaks distance ties by id for a byte-stable order', () => {
    // Same coordinate ⇒ identical distance; order must be deterministic by id.
    const order = rankByProximity(origin, [
      poi('zebra', 0.001, 'food'),
      poi('alpha', 0.001, 'food'),
    ]);
    expect(order.map((r) => r.id)).toEqual(['alpha', 'zebra']);
    const reversed = rankByProximity(origin, [
      poi('alpha', 0.001, 'food'),
      poi('zebra', 0.001, 'food'),
    ]);
    expect(reversed.map((r) => r.id)).toEqual(['alpha', 'zebra']); // same regardless of input order
  });
});

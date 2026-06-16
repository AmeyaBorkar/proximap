import type { NearbyResult, Place } from '@proximap/core';
import { describe, expect, it } from 'vitest';
import { renderGeocode, renderNearby } from './render';

const result: NearbyResult = {
  origin: {
    name: 'Origin',
    displayName: 'Origin City, Country',
    location: { lat: 1.23, lng: 4.56 },
    source: 'test',
  },
  total: 2,
  results: [
    {
      id: 'node/1',
      name: 'Near Shop',
      category: 'shopping',
      kind: 'supermarket',
      location: { lat: 1, lng: 4 },
      tags: {},
      source: 'test',
      distanceMeters: 120,
      score: 0.9,
      rank: 1,
    },
    {
      id: 'node/2',
      category: 'food',
      kind: 'cafe',
      location: { lat: 1, lng: 4 },
      tags: {},
      source: 'test',
      distanceMeters: 1400,
      score: 0.5,
      rank: 2,
    },
  ],
};

describe('renderNearby', () => {
  it('includes origin, counts, names, categories, and distances', () => {
    const out = renderNearby(result);
    expect(out).toContain('Origin City, Country');
    expect(out).toContain('2 found, showing 2');
    expect(out).toContain('Near Shop');
    expect(out).toContain('Shopping');
    expect(out).toContain('120 m');
    expect(out).toContain('1.4 km');
  });

  it('falls back to kind when a POI has no name', () => {
    expect(renderNearby(result)).toContain('cafe');
  });

  it('handles an empty result set', () => {
    const empty: NearbyResult = { ...result, results: [], total: 0 };
    expect(renderNearby(empty)).toContain('No amenities found');
  });
});

describe('renderGeocode', () => {
  it('lists candidates with address and coordinates', () => {
    const places: Place[] = [
      { name: 'A', displayName: 'A, Country', location: { lat: 1, lng: 2 }, source: 'test' },
    ];
    const out = renderGeocode(places);
    expect(out).toContain('A, Country');
    expect(out).toContain('1.00000, 2.00000');
  });

  it('reports when there are no matches', () => {
    expect(renderGeocode([])).toBe('No matches found.');
  });
});

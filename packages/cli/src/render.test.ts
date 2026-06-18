import type { GapReport, NearbyResult, Place } from '@proximap/core';
import { describe, expect, it } from 'vitest';
import { renderGaps, renderGeocode, renderNearby } from './render';

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

  it('does not overstate the count of distinct places in the ambiguity banner', () => {
    // 3 candidates, but only 2 are genuinely distinct rivals — the banner must
    // not claim "3 distinct places" (the full candidate count).
    const places: Place[] = [
      {
        name: 'Springfield',
        displayName: 'Springfield, IL',
        location: { lat: 39.8, lng: -89.6 },
        source: 'test',
      },
      {
        name: 'Springfield',
        displayName: 'Springfield, MO',
        location: { lat: 37.2, lng: -93.3 },
        source: 'test',
      },
      {
        name: 'Springfield',
        displayName: 'Springfield (variant)',
        location: { lat: 39.81, lng: -89.61 },
        source: 'test',
      },
    ];
    const out = renderGeocode(places, true);
    expect(out).toContain('Ambiguous');
    expect(out).not.toMatch(/\d+ distinct/);
  });
});

describe('renderGaps', () => {
  it('shows a checklist with marks, distances, and the missing list', () => {
    const report: GapReport = {
      origin: { name: 'O', displayName: 'O City', location: { lat: 1, lng: 2 }, source: 'test' },
      searchRadiusMeters: 5000,
      thresholdMeters: 1000,
      gaps: [
        { category: 'grocery', nearestMeters: 120, isGap: false },
        { category: 'pharmacy', nearestMeters: null, isGap: true },
      ],
      missing: ['pharmacy'],
    };
    const out = renderGaps(report);
    expect(out).toContain('Grocery');
    expect(out).toContain('120 m');
    expect(out).toContain('Pharmacy');
    expect(out).toContain('none within');
    expect(out).toContain('Missing (not found in OSM): pharmacy');
  });
});

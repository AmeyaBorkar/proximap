import type { GapReport, NearbyResult, Place } from '@proximap/core';
import { describe, expect, it } from 'vitest';
import { toGapsPayload, toGeocodePayload, toNearbyPayload } from './payload';

describe('toNearbyPayload', () => {
  it('flattens the origin, rounds distances, and nulls missing fields', () => {
    const result: NearbyResult = {
      origin: { name: 'O', displayName: 'O City', location: { lat: 1, lng: 2 }, source: 'test' },
      total: 1,
      results: [
        {
          id: 'node/1',
          category: 'food',
          kind: 'cafe',
          location: { lat: 3, lng: 4 },
          tags: {},
          source: 'test',
          distanceMeters: 120.7,
          score: 0.9,
          rank: 1,
        },
      ],
    };

    const payload = toNearbyPayload(result);
    expect(payload.origin).toEqual({ name: 'O', displayName: 'O City', lat: 1, lng: 2 });
    expect(payload.count).toBe(1);
    expect(payload.results[0]).toMatchObject({
      rank: 1,
      name: null,
      category: 'food',
      kind: 'cafe',
      distanceMeters: 121,
      osmId: 'node/1',
      completeness: null,
      lastVerified: null,
    });
  });
});

describe('toGeocodePayload', () => {
  it('maps places to compact records', () => {
    const places: Place[] = [
      { name: 'A', displayName: 'A, C', location: { lat: 1, lng: 2 }, source: 'test' },
    ];
    expect(toGeocodePayload(places)).toEqual([
      { name: 'A', displayName: 'A, C', lat: 1, lng: 2, kind: null },
    ]);
  });
});

describe('toGapsPayload', () => {
  it('flattens the origin and passes through gaps and missing', () => {
    const report: GapReport = {
      origin: { name: 'O', displayName: 'O City', location: { lat: 1, lng: 2 }, source: 'test' },
      searchRadiusMeters: 5000,
      thresholdMeters: 1000,
      gaps: [{ category: 'grocery', nearestMeters: 120, isGap: false }],
      missing: [],
    };
    const payload = toGapsPayload(report);
    expect(payload.origin).toEqual({ name: 'O', displayName: 'O City', lat: 1, lng: 2 });
    expect(payload.missing).toEqual([]);
    expect(payload.gaps[0]).toMatchObject({ category: 'grocery', isGap: false });
  });
});

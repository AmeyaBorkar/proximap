import type { NearbyResult, Place } from '@proximap/core';
import { describe, expect, it } from 'vitest';
import { toGeocodePayload, toNearbyPayload } from './payload';

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

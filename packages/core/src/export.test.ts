import { describe, expect, it } from 'vitest';
import { ODBL_ATTRIBUTION, toCSV, toGeoJSON } from './export';
import type { NearbyResult } from './nearby';
import type { RankedPoi } from './types';

const poi = (overrides: Partial<RankedPoi>): RankedPoi => ({
  id: 'node/1',
  category: 'food',
  location: { lat: 52.5, lng: 13.4 },
  tags: {},
  source: 'test',
  distanceMeters: 123.6,
  score: 0.9,
  rank: 1,
  ...overrides,
});

const result = (results: RankedPoi[]): NearbyResult => ({
  origin: { name: 'O', displayName: 'Origin', location: { lat: 52.5, lng: 13.4 }, source: 'test' },
  results,
  total: results.length,
});

describe('toGeoJSON', () => {
  it('produces a FeatureCollection with ODbL attribution', () => {
    const fc = toGeoJSON(result([poi({})]));
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.attribution).toBe(ODBL_ATTRIBUTION);
    expect(fc.features).toHaveLength(1);
  });

  it('uses [lng, lat] coordinate order and rounds distance', () => {
    const fc = toGeoJSON(result([poi({ name: 'Cafe', kind: 'cafe' })]));
    const feature = fc.features[0]!;
    expect(feature.geometry.coordinates).toEqual([13.4, 52.5]);
    expect(feature.properties.distanceMeters).toBe(124);
    expect(feature.properties.name).toBe('Cafe');
  });

  it('includes quality and open-state properties only when present', () => {
    const withMeta = toGeoJSON(
      result([poi({ completeness: 0.5, lastVerified: '2025-01-01', openState: 'open' })]),
    );
    expect(withMeta.features[0]!.properties.completeness).toBe(0.5);
    expect(withMeta.features[0]!.properties.openState).toBe('open');

    const without = toGeoJSON(result([poi({})]));
    expect(without.features[0]!.properties).not.toHaveProperty('completeness');
    expect(without.features[0]!.properties).not.toHaveProperty('openState');
  });
});

describe('toCSV', () => {
  it('emits a header and one row per POI', () => {
    const csv = toCSV(result([poi({ name: 'Cafe', kind: 'cafe' })]));
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'rank,name,category,kind,distance_m,lat,lng,osm_id,completeness,last_verified,open_state',
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('1,Cafe,food,cafe,124,52.5,13.4,node/1');
  });

  it('quotes fields containing commas or quotes (RFC 4180)', () => {
    const csv = toCSV(result([poi({ name: 'Joe\'s, Bar "Best"' })]));
    expect(csv.split('\n')[1]).toContain('"Joe\'s, Bar ""Best"""');
  });

  it('leaves optional columns empty when absent', () => {
    const row = toCSV(result([poi({})])).split('\n')[1]!;
    expect(row.endsWith(',,,')).toBe(true); // completeness,last_verified,open_state all empty
  });
});

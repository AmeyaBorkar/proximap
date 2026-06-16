import { describe, expect, it } from 'vitest';
import { findNearbyAmenities } from './nearby';
import { DatasetPlacesProvider, snapshotArea } from './snapshot';
import type { GeocodingProvider, PlacesProvider, Poi } from './types';

const geocoder: GeocodingProvider = {
  name: 'fake',
  async geocode() {
    return [{ name: 'O', displayName: 'Origin', location: { lat: 0, lng: 0 }, source: 'fake' }];
  },
};

const captured: Poi[] = [
  {
    id: 'node/1',
    name: 'Bean',
    category: 'food',
    kind: 'cafe',
    location: { lat: 0, lng: 0.001 },
    tags: { amenity: 'cafe' },
    source: 'fake',
  },
  {
    id: 'node/2',
    name: 'Bank',
    category: 'finance',
    kind: 'bank',
    location: { lat: 0, lng: 0.005 },
    tags: { amenity: 'bank' },
    source: 'fake',
  },
];

const places: PlacesProvider = {
  name: 'fake',
  async findNearby() {
    return captured;
  },
};

describe('snapshotArea', () => {
  it('captures POIs with attribution and metadata', async () => {
    const dataset = await snapshotArea('here', {
      geocoder,
      places,
      radiusMeters: 2000,
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(dataset.pois).toHaveLength(2);
    expect(dataset.center).toEqual({ lat: 0, lng: 0 });
    expect(dataset.radiusMeters).toBe(2000);
    expect(dataset.attribution).toMatch(/OpenStreetMap/);
    expect(dataset.createdAt).toBe('2026-01-01T00:00:00Z');
  });
});

describe('DatasetPlacesProvider', () => {
  const dataset = {
    attribution: 'x',
    createdAt: '2026-01-01T00:00:00Z',
    center: { lat: 0, lng: 0 },
    radiusMeters: 2000,
    pois: captured,
  };

  it('filters by radius offline', async () => {
    const provider = new DatasetPlacesProvider(dataset);
    const within300 = await provider.findNearby({ lat: 0, lng: 0 }, { radiusMeters: 300 });
    expect(within300.map((p) => p.id)).toEqual(['node/1']); // bank is ~556 m, excluded
  });

  it('filters by selectors offline', async () => {
    const provider = new DatasetPlacesProvider(dataset);
    const banks = await provider.findNearby(
      { lat: 0, lng: 0 },
      { radiusMeters: 2000, selectors: [{ key: 'amenity', value: 'bank' }] },
    );
    expect(banks.map((p) => p.id)).toEqual(['node/2']);
  });

  it('backs a fully offline findNearbyAmenities (no network)', async () => {
    const dataProvider = new DatasetPlacesProvider(dataset);
    const { results } = await findNearbyAmenities('0,0', {
      geocoder,
      places: dataProvider,
      categories: ['coffee'],
    });
    expect(results.map((r) => r.id)).toEqual(['node/1']);
  });
});

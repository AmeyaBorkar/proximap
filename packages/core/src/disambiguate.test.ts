import { describe, expect, it } from 'vitest';
import { disambiguateLocation } from './disambiguate';
import type { GeocodingProvider, Place } from './types';

const place = (name: string, lat: number, lng: number, importance = 0): Place => ({
  name,
  displayName: `${name}, Somewhere`,
  location: { lat, lng },
  source: 'fake',
  raw: { importance },
});

const geocoderOf = (results: Place[]): GeocodingProvider => ({
  name: 'fake',
  async geocode() {
    return results;
  },
});

describe('disambiguateLocation', () => {
  it('flags distinct same-name places far apart as ambiguous', async () => {
    const geocoder = geocoderOf([
      place('Springfield', 39.8, -89.64, 0.5), // Illinois
      place('Springfield', 37.21, -93.29, 0.45), // Missouri — far, same name
    ]);
    const result = await disambiguateLocation('Springfield', { geocoder });
    expect(result.ambiguous).toBe(true);
    expect(result.best!.name).toBe('Springfield');
    expect(result.candidates).toHaveLength(2);
  });

  it('is not ambiguous for a single confident result', async () => {
    const geocoder = geocoderOf([place('Berlin', 52.52, 13.4, 0.85)]);
    const result = await disambiguateLocation('Berlin', { geocoder });
    expect(result.ambiguous).toBe(false);
    expect(result.best!.name).toBe('Berlin');
  });

  it('is not ambiguous when the runner-up is nearby (same place)', async () => {
    const geocoder = geocoderOf([
      place('Paris', 48.857, 2.352, 0.9),
      place('Paris', 48.86, 2.34, 0.3), // ~1 km away → same metro, not a rival
    ]);
    const result = await disambiguateLocation('Paris', { geocoder });
    expect(result.ambiguous).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NominatimGeocoder } from './nominatim';

function stubFetch(payload: unknown) {
  const response = {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
  const fetchMock = vi.fn(
    (_input: unknown, _init?: RequestInit): Promise<Response> => Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('NominatimGeocoder', () => {
  it('geocodes a query into places', async () => {
    const fetchMock = stubFetch([
      {
        place_id: 1,
        lat: '48.8584',
        lon: '2.2945',
        name: 'Eiffel Tower',
        display_name: 'Eiffel Tower, Paris, France',
        class: 'tourism',
        type: 'attraction',
        boundingbox: ['48.85', '48.86', '2.29', '2.30'],
      },
    ]);
    const places = await new NominatimGeocoder().geocode('Eiffel Tower');

    expect(places).toHaveLength(1);
    const place = places[0]!;
    expect(place).toMatchObject({
      name: 'Eiffel Tower',
      displayName: 'Eiffel Tower, Paris, France',
      kind: 'attraction',
      source: 'nominatim',
    });
    expect(place.location.lat).toBeCloseTo(48.8584, 4);
    expect(place.location.lng).toBeCloseTo(2.2945, 4);
    expect(place.boundingBox).toEqual([48.85, 48.86, 2.29, 2.3]);

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain('nominatim.openstreetmap.org/search');
    expect(url).toContain('q=Eiffel+Tower');
  });

  it('returns null from reverse on an error payload', async () => {
    stubFetch({ error: 'Unable to geocode' });
    await expect(new NominatimGeocoder().reverse({ lat: 0, lng: 0 })).resolves.toBeNull();
  });

  it('respects a custom endpoint', async () => {
    const fetchMock = stubFetch([]);
    await new NominatimGeocoder({ endpoint: 'https://geo.example.com/' }).geocode('x');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('https://geo.example.com/search');
  });
});

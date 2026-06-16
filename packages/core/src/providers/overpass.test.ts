import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOverpassQuery, OverpassPlacesProvider } from './overpass';

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

const ELEMENTS = {
  elements: [
    { type: 'node', id: 1, lat: 48.8585, lon: 2.295, tags: { amenity: 'cafe', name: 'Cafe A' } },
    {
      type: 'way',
      id: 2,
      center: { lat: 48.859, lon: 2.296 },
      tags: { shop: 'supermarket', name: 'Market' },
    },
    { type: 'node', id: 3, lat: 48.8586, lon: 2.2951 }, // no tags -> skipped
  ],
};

describe('buildOverpassQuery', () => {
  it('embeds the radius and center and asks for centers + tags', () => {
    const query = buildOverpassQuery({ lat: 1.5, lng: -2.5 }, 750);
    expect(query).toContain('around:750,1.5,-2.5');
    expect(query).toContain('nwr["amenity"]');
    expect(query).toContain('out center tags;');
  });
});

describe('OverpassPlacesProvider', () => {
  it('parses nodes and way centers into categorized POIs', async () => {
    stubFetch(ELEMENTS);
    const pois = await new OverpassPlacesProvider().findNearby(
      { lat: 48.8584, lng: 2.2945 },
      { radiusMeters: 500 },
    );

    expect(pois.map((p) => p.id)).toEqual(['node/1', 'way/2']);
    const market = pois.find((p) => p.id === 'way/2')!;
    expect(market.category).toBe('grocery');
    expect(market.location).toEqual({ lat: 48.859, lng: 2.296 });
  });

  it('filters by requested categories', async () => {
    stubFetch(ELEMENTS);
    const pois = await new OverpassPlacesProvider().findNearby(
      { lat: 48.8584, lng: 2.2945 },
      { radiusMeters: 500, categories: ['grocery'] },
    );
    expect(pois).toHaveLength(1);
    expect(pois[0]!.category).toBe('grocery');
  });

  it('POSTs the encoded query in the request body', async () => {
    const fetchMock = stubFetch(ELEMENTS);
    await new OverpassPlacesProvider().findNearby({ lat: 1, lng: 2 }, { radiusMeters: 100 });
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('around%3A100%2C1%2C2');
  });
});

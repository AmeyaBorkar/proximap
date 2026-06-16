import { parseCoordinates } from './geo';
import type { GeocodingProvider, LatLng, Place } from './types';

export interface ResolveOriginOptions {
  language?: string;
  signal?: AbortSignal;
}

/**
 * Resolve a place name, a "lat,lng" string, or a {@link LatLng} into an origin
 * {@link Place}. Coordinate inputs are enriched with a best-effort reverse
 * geocode when the provider supports it, falling back to the raw coordinates.
 */
export async function resolveOrigin(
  query: string | LatLng,
  geocoder: GeocodingProvider,
  options: ResolveOriginOptions = {},
): Promise<Place> {
  if (typeof query !== 'string') return originFromCoords(query, geocoder, options);

  const coords = parseCoordinates(query);
  if (coords) return originFromCoords(coords, geocoder, options);

  const matches = await geocoder.geocode(query, { limit: 1, ...geoOptions(options) });
  const first = matches[0];
  if (!first) throw new Error(`No location found for query: "${query}"`);
  return first;
}

async function originFromCoords(
  coords: LatLng,
  geocoder: GeocodingProvider,
  options: ResolveOriginOptions,
): Promise<Place> {
  const label = `${coords.lat}, ${coords.lng}`;
  const fallback: Place = {
    name: label,
    displayName: label,
    location: coords,
    source: 'coordinates',
  };
  if (geocoder.reverse) {
    try {
      const reversed = await geocoder.reverse(coords, geoOptions(options));
      if (reversed) return reversed;
    } catch {
      // Reverse geocoding is best-effort; fall back to the raw coordinates.
    }
  }
  return fallback;
}

function geoOptions(options: ResolveOriginOptions): { language?: string; signal?: AbortSignal } {
  const out: { language?: string; signal?: AbortSignal } = {};
  if (options.language) out.language = options.language;
  if (options.signal) out.signal = options.signal;
  return out;
}

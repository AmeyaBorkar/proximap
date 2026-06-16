import { ODBL_ATTRIBUTION } from './export';
import { haversineMeters } from './geo';
import { resolveOrigin } from './origin';
import { NominatimGeocoder } from './providers/nominatim';
import { OverpassPlacesProvider } from './providers/overpass';
import { resolveCategories, suggestCategories, tagsMatchAnySelector } from './taxonomy';
import type {
  Category,
  GeocodingProvider,
  LatLng,
  NearbyOptions,
  PlacesProvider,
  Poi,
} from './types';

/**
 * A stored snapshot of an area's POIs. OSM data (ODbL) may be freely stored and
 * redistributed — the advantage commercial APIs forbid — so this is a portable,
 * offline-queryable dataset. Keep the `attribution` with the data.
 */
export interface SnapshotDataset {
  attribution: string;
  /** ISO timestamp the snapshot was captured. */
  createdAt: string;
  /** Center the snapshot was taken around. */
  center: LatLng;
  /** Radius captured, in metres. */
  radiusMeters: number;
  /** Normalized, deduplicated POIs in the area. */
  pois: Poi[];
}

export interface SnapshotOptions {
  /** Radius to capture, in metres (default 2000). */
  radiusMeters?: number;
  /** Restrict the capture to these categories/terms (default: all amenities). */
  categories?: Array<Category | (string & {})>;
  geocoder?: GeocodingProvider;
  places?: PlacesProvider;
  language?: string;
  signal?: AbortSignal;
  /** Override the capture timestamp (ISO) — for deterministic output/tests. */
  createdAt?: string;
}

const DEFAULT_SNAPSHOT_RADIUS_M = 2000;

/**
 * Capture an area's POIs into a {@link SnapshotDataset} for offline reuse. Pair
 * with {@link DatasetPlacesProvider} to answer queries with no network calls.
 */
export async function snapshotArea(
  query: string | LatLng,
  options: SnapshotOptions = {},
): Promise<SnapshotDataset> {
  const radiusMeters = options.radiusMeters ?? DEFAULT_SNAPSHOT_RADIUS_M;
  const geocoder = options.geocoder ?? new NominatimGeocoder();
  const places = options.places ?? new OverpassPlacesProvider();

  let selectors;
  if (options.categories && options.categories.length > 0) {
    const resolved = resolveCategories(options.categories);
    if (resolved.unknown.length > 0) {
      const detail = resolved.unknown
        .map((term) => {
          const suggestions = suggestCategories(term);
          return suggestions.length > 0
            ? `"${term}" (did you mean: ${suggestions.join(', ')}?)`
            : `"${term}"`;
        })
        .join('; ');
      throw new Error(`Unknown categor${resolved.unknown.length > 1 ? 'ies' : 'y'}: ${detail}`);
    }
    selectors = resolved.selectors;
  }

  const origin = await resolveOrigin(query, geocoder, {
    language: options.language,
    signal: options.signal,
  });

  const nearbyOptions: NearbyOptions = { radiusMeters };
  if (selectors && selectors.length > 0) nearbyOptions.selectors = selectors;
  if (options.signal) nearbyOptions.signal = options.signal;
  const pois = await places.findNearby(origin.location, nearbyOptions);

  return {
    attribution: ODBL_ATTRIBUTION,
    createdAt: options.createdAt ?? new Date().toISOString(),
    center: origin.location,
    radiusMeters,
    pois,
  };
}

/**
 * A {@link PlacesProvider} backed by a stored {@link SnapshotDataset} — answers
 * nearby queries entirely from memory, with no network. Use a "lat,lng" query
 * (no geocoding) for a fully offline pipeline.
 */
export class DatasetPlacesProvider implements PlacesProvider {
  readonly name = 'dataset';
  private readonly pois: Poi[];

  constructor(dataset: SnapshotDataset) {
    this.pois = dataset.pois;
  }

  async findNearby(center: LatLng, options: NearbyOptions): Promise<Poi[]> {
    const { radiusMeters, selectors } = options;
    return this.pois.filter((poi) => {
      if (haversineMeters(center, poi.location) > radiusMeters) return false;
      if (selectors && selectors.length > 0) return tagsMatchAnySelector(poi.tags, selectors);
      return true;
    });
  }
}

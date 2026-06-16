import { haversineMeters } from './geo';
import { resolveOrigin } from './origin';
import { NominatimGeocoder } from './providers/nominatim';
import { OverpassPlacesProvider } from './providers/overpass';
import { resolveCategories, suggestCategories, tagsMatchAnySelector } from './taxonomy';
import type {
  CategorySelector,
  GeocodingProvider,
  LatLng,
  NearbyOptions,
  Place,
  PlacesProvider,
  Poi,
} from './types';

/** Everyday needs a well-served neighbourhood should provide nearby. */
export const DEFAULT_DAILY_NEEDS = [
  'grocery',
  'pharmacy',
  'healthcare',
  'food',
  'finance',
  'transport',
  'education',
  'park',
] as const;

export interface GapOptions {
  /** Category terms to check (default: {@link DEFAULT_DAILY_NEEDS}). */
  categories?: string[];
  /** How far to look for the nearest instance, in metres (default 5000). */
  searchRadiusMeters?: number;
  /** Distance beyond which a category counts as a gap, in metres (default 1500). */
  thresholdMeters?: number;
  geocoder?: GeocodingProvider;
  places?: PlacesProvider;
  language?: string;
  signal?: AbortSignal;
}

export interface CategoryGap {
  /** The requested category term. */
  category: string;
  /** Distance to the nearest match, or null if none was found within the search radius. */
  nearestMeters: number | null;
  isGap: boolean;
  /** Data-completeness of the nearest match (a confidence hint), when known. */
  nearestCompleteness?: number;
}

export interface GapReport {
  origin: Place;
  searchRadiusMeters: number;
  thresholdMeters: number;
  /** Every requested category with its nearest-match status. */
  gaps: CategoryGap[];
  /** Categories flagged as gaps — i.e. not found in OSM within the threshold. */
  missing: string[];
}

const DEFAULT_SEARCH_RADIUS_M = 5000;
const DEFAULT_THRESHOLD_M = 1500;

function nearestMatch(
  origin: LatLng,
  pois: Poi[],
  selectors: CategorySelector[],
): { meters: number | null; poi: Poi | null } {
  let bestMeters: number | null = null;
  let bestPoi: Poi | null = null;
  for (const poi of pois) {
    if (!tagsMatchAnySelector(poi.tags, selectors)) continue;
    const meters = haversineMeters(origin, poi.location);
    if (bestMeters === null || meters < bestMeters) {
      bestMeters = meters;
      bestPoi = poi;
    }
  }
  return { meters: bestMeters, poi: bestPoi };
}

/**
 * Report which everyday amenities are missing or far from a location — the
 * inverse of "what's nearby". Because OSM under-maps some areas, absence is
 * framed as "not found in OSM within the threshold", never asserted as truth;
 * `nearestCompleteness` hints at data confidence.
 */
export async function detectGaps(
  query: string | LatLng,
  options: GapOptions = {},
): Promise<GapReport> {
  const terms =
    options.categories && options.categories.length > 0
      ? options.categories
      : [...DEFAULT_DAILY_NEEDS];
  const searchRadiusMeters = options.searchRadiusMeters ?? DEFAULT_SEARCH_RADIUS_M;
  const thresholdMeters = options.thresholdMeters ?? DEFAULT_THRESHOLD_M;
  const geocoder = options.geocoder ?? new NominatimGeocoder();
  const places = options.places ?? new OverpassPlacesProvider();

  const resolved = resolveCategories(terms);
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

  const origin = await resolveOrigin(query, geocoder, {
    language: options.language,
    signal: options.signal,
  });

  const nearbyOptions: NearbyOptions = {
    radiusMeters: searchRadiusMeters,
    selectors: resolved.selectors,
  };
  if (options.signal) nearbyOptions.signal = options.signal;
  const pois = await places.findNearby(origin.location, nearbyOptions);

  const gaps: CategoryGap[] = terms.map((term) => {
    const selectors = resolveCategories([term]).selectors;
    const { meters, poi } = nearestMatch(origin.location, pois, selectors);
    const gap: CategoryGap = {
      category: term,
      nearestMeters: meters === null ? null : Math.round(meters),
      isGap: meters === null || meters > thresholdMeters,
    };
    if (poi?.completeness !== undefined) gap.nearestCompleteness = poi.completeness;
    return gap;
  });

  return {
    origin,
    searchRadiusMeters,
    thresholdMeters,
    gaps,
    missing: gaps.filter((gap) => gap.isGap).map((gap) => gap.category),
  };
}

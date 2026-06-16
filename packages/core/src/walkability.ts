import { resolveOrigin } from './origin';
import { nearestMatchingPoi } from './proximity';
import { NominatimGeocoder } from './providers/nominatim';
import { OverpassPlacesProvider } from './providers/overpass';
import { resolveCategories, suggestCategories } from './taxonomy';
import type { GeocodingProvider, LatLng, NearbyOptions, Place, PlacesProvider } from './types';

/**
 * A daily-need category and how much it counts toward the walkability score.
 * Weights are relative — the score normalizes by their sum.
 */
export interface CategoryWeight {
  /** A natural-language category term (resolved via the taxonomy). */
  term: string;
  weight: number;
}

/**
 * Default basket of daily needs and weights, loosely modelled on the published
 * Walk Score categories but fully open and tunable. Groceries, food, pharmacy,
 * and transit count most; civic/leisure round out a complete neighbourhood.
 */
export const DEFAULT_WALK_CATEGORIES: CategoryWeight[] = [
  { term: 'grocery', weight: 3 },
  { term: 'food', weight: 2 },
  { term: 'pharmacy', weight: 2 },
  { term: 'transport', weight: 2 },
  { term: 'education', weight: 1 },
  { term: 'healthcare', weight: 1 },
  { term: 'finance', weight: 1 },
  { term: 'park', weight: 1 },
  { term: 'shopping', weight: 1 },
];

export interface WalkabilityDecay {
  /** At/below this distance (m) a category scores full marks (default 400 ≈ 5-min walk). */
  idealMeters?: number;
  /** At/beyond this distance (m) a category scores zero (default 2400 ≈ 30-min walk). */
  maxMeters?: number;
}

export interface WalkabilityOptions {
  /** Daily-need categories and weights (default {@link DEFAULT_WALK_CATEGORIES}). */
  categories?: CategoryWeight[];
  /** Distance-decay tuning (defaults: full credit ≤ 400 m, zero ≥ 2400 m). */
  decay?: WalkabilityDecay;
  /** How far to search for the nearest of each category (default = decay max). */
  searchRadiusMeters?: number;
  geocoder?: GeocodingProvider;
  places?: PlacesProvider;
  language?: string;
  signal?: AbortSignal;
}

export interface CategoryScore {
  category: string;
  weight: number;
  /** Distance to the nearest match, or null if none found within the search radius. */
  nearestMeters: number | null;
  /** Distance-decay sub-score in [0, 1]. */
  subScore: number;
  /** Data-completeness of the nearest match (a confidence hint), when known. */
  nearestCompleteness?: number;
}

export interface WalkabilityReport {
  origin: Place;
  /** Overall walkability in [0, 100]; higher is more walkable. */
  score: number;
  /**
   * Confidence in [0, 1] reflecting OSM data density around the origin — low
   * where few categories were found or their tagging is sparse. A low score
   * with low confidence means "thin data here", not "nothing here".
   */
  confidence: number;
  /** Per-category nearest distance and sub-score. */
  breakdown: CategoryScore[];
  /** Categories with no match found within the search radius. */
  missing: string[];
  /** The distance-decay bounds actually used. */
  decay: { idealMeters: number; maxMeters: number };
}

const DEFAULT_IDEAL_M = 400;
const DEFAULT_MAX_M = 2400;

/**
 * Distance-decay sub-score: full credit within `ideal`, linearly declining to
 * zero at `max`. Deliberately simple and transparent so the score is auditable
 * and tunable, unlike opaque proprietary indices.
 */
export function walkSubScore(
  meters: number | null,
  idealMeters: number,
  maxMeters: number,
): number {
  if (meters === null) return 0;
  if (meters <= idealMeters) return 1;
  if (meters >= maxMeters) return 0;
  return round2((maxMeters - meters) / (maxMeters - idealMeters));
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const mean = (xs: number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/**
 * Score how walkable / well-served a location is: a 0–100 number plus a full
 * per-category breakdown, the categories that are missing, and a data-confidence
 * note. An open, transparent, tunable, OSM-native alternative to proprietary
 * walkability indices — every input is visible and adjustable.
 */
export async function walkabilityScore(
  query: string | LatLng,
  options: WalkabilityOptions = {},
): Promise<WalkabilityReport> {
  const categories =
    options.categories && options.categories.length > 0
      ? options.categories
      : DEFAULT_WALK_CATEGORIES;
  const idealMeters = options.decay?.idealMeters ?? DEFAULT_IDEAL_M;
  const maxMeters = options.decay?.maxMeters ?? DEFAULT_MAX_M;
  const searchRadiusMeters = options.searchRadiusMeters ?? maxMeters;
  const geocoder = options.geocoder ?? new NominatimGeocoder();
  const places = options.places ?? new OverpassPlacesProvider();

  const terms = categories.map((c) => c.term);
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

  const breakdown: CategoryScore[] = categories.map(({ term, weight }) => {
    const selectors = resolveCategories([term]).selectors;
    const { meters, poi } = nearestMatchingPoi(origin.location, pois, selectors);
    const nearestMeters = meters === null ? null : Math.round(meters);
    const entry: CategoryScore = {
      category: term,
      weight,
      nearestMeters,
      subScore: walkSubScore(meters, idealMeters, maxMeters),
    };
    if (poi?.completeness !== undefined) entry.nearestCompleteness = poi.completeness;
    return entry;
  });

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0) || 1;
  const weighted = breakdown.reduce((sum, b) => sum + b.weight * b.subScore, 0);
  const score = Math.round((100 * weighted) / totalWeight);

  const found = breakdown.filter((b) => b.nearestMeters !== null);
  const coverage = breakdown.length ? found.length / breakdown.length : 0;
  const avgCompleteness = mean(found.map((b) => b.nearestCompleteness ?? 0));
  const confidence = round2(0.7 * coverage + 0.3 * avgCompleteness);

  return {
    origin,
    score,
    confidence,
    breakdown,
    missing: breakdown.filter((b) => b.nearestMeters === null).map((b) => b.category),
    decay: { idealMeters, maxMeters },
  };
}

import { NominatimGeocoder } from './providers/nominatim';
import { OverpassPlacesProvider } from './providers/overpass';
import type { GeocodingProvider, LatLng, Place, PlacesProvider } from './types';
import {
  DEFAULT_WALK_CATEGORIES,
  walkabilityScore,
  type CategoryScore,
  type CategoryWeight,
  type WalkabilityDecay,
} from './walkability';

export interface CompareOptions {
  /** Dimensions and weights to compare on (default: the walkability basket). */
  categories?: CategoryWeight[];
  /** Distance-decay tuning, passed through to each location's scoring. */
  decay?: WalkabilityDecay;
  /** How far to search around each location (default = decay max). */
  searchRadiusMeters?: number;
  geocoder?: GeocodingProvider;
  places?: PlacesProvider;
  language?: string;
  signal?: AbortSignal;
}

export interface LocationScore {
  origin: Place;
  /** Walkability score (0–100) under the comparison weights. */
  score: number;
  confidence: number;
  breakdown: CategoryScore[];
  missing: string[];
}

export interface DimensionWinner {
  category: string;
  weight: number;
  /** Index into `locations` of the best location for this dimension, or null if none has it. */
  bestIndex: number | null;
}

export interface RankedLocation {
  /** Index into `locations` (input order). */
  index: number;
  score: number;
  origin: Place;
}

export interface ComparisonReport {
  /** Each location's score, in input order. */
  locations: LocationScore[];
  /** Locations sorted best-first (ties: higher confidence, then input order). */
  ranked: RankedLocation[];
  /** The top-ranked location, or null if no candidates were given. */
  best: RankedLocation | null;
  /** For each dimension, which location is best served. */
  dimensions: DimensionWinner[];
  /** The weights actually used. */
  weights: CategoryWeight[];
}

/**
 * Compare N candidate locations across weighted daily-need dimensions and rank
 * them — a key-free, arbitrary-N, OSM-native relocation/siting scorecard. Pure
 * composition over {@link walkabilityScore}: each location is scored the same
 * way, then ranked and compared dimension-by-dimension.
 *
 * Out of scope by design (not in OSM): transit *frequency*, school quality,
 * crime, prices. We compare amenity *access*, and carry through walkability's
 * confidence so thin data reads as low confidence, not a confident zero.
 */
export async function compareLocations(
  queries: ReadonlyArray<string | LatLng>,
  options: CompareOptions = {},
): Promise<ComparisonReport> {
  if (queries.length < 2) {
    throw new Error('compareLocations needs at least two locations to compare.');
  }
  const categories =
    options.categories && options.categories.length > 0
      ? options.categories
      : DEFAULT_WALK_CATEGORIES;
  const geocoder = options.geocoder ?? new NominatimGeocoder();
  const places = options.places ?? new OverpassPlacesProvider();

  // Sequential, with shared providers, so the OSM rate limiters stay polite.
  const locations: LocationScore[] = [];
  for (const query of queries) {
    const walk = await walkabilityScore(query, {
      categories,
      geocoder,
      places,
      ...(options.decay ? { decay: options.decay } : {}),
      ...(options.searchRadiusMeters ? { searchRadiusMeters: options.searchRadiusMeters } : {}),
      ...(options.language ? { language: options.language } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    locations.push({
      origin: walk.origin,
      score: walk.score,
      confidence: walk.confidence,
      breakdown: walk.breakdown,
      missing: walk.missing,
    });
  }

  const ranked: RankedLocation[] = locations
    .map((location, index) => ({ index, location }))
    .sort(
      (a, b) =>
        b.location.score - a.location.score ||
        b.location.confidence - a.location.confidence ||
        a.index - b.index,
    )
    .map(({ index, location }) => ({ index, score: location.score, origin: location.origin }));

  const dimensions: DimensionWinner[] = categories.map(({ term, weight }) => ({
    category: term,
    weight,
    bestIndex: bestForDimension(locations, term),
  }));

  return {
    locations,
    ranked,
    best: ranked[0] ?? null,
    dimensions,
    weights: categories,
  };
}

/** The index of the location best served for a category: highest sub-score, nearest on ties. */
function bestForDimension(locations: readonly LocationScore[], term: string): number | null {
  let bestIndex: number | null = null;
  let bestSub = -1;
  let bestMeters = Infinity;
  locations.forEach((location, index) => {
    const entry = location.breakdown.find((b) => b.category === term);
    if (!entry || entry.nearestMeters === null) return;
    if (
      entry.subScore > bestSub ||
      (entry.subScore === bestSub && entry.nearestMeters < bestMeters)
    ) {
      bestSub = entry.subScore;
      bestMeters = entry.nearestMeters;
      bestIndex = index;
    }
  });
  return bestIndex;
}

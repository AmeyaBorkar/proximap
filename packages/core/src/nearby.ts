import { accessibleScorer, compileFacets, matchesFacets, type FacetFilters } from './filters';
import { isOpenAt, type OpeningEvaluation } from './hours';
import { resolveOrigin } from './origin';
import { NominatimGeocoder } from './providers/nominatim';
import { OverpassPlacesProvider } from './providers/overpass';
import { rankByProximity, type RankOptions } from './ranking';
import { resolveCategories, suggestCategories, tagsMatchAnySelector } from './taxonomy';
import type {
  Category,
  CategorySelector,
  GeocodingProvider,
  LatLng,
  NearbyOptions,
  Place,
  PlacesProvider,
  RankedPoi,
} from './types';

export interface FindNearbyOptions {
  /** Search radius in metres (default 1000). */
  radiusMeters?: number;
  /**
   * Restrict to these categories. Accepts the 16 normalized category names and
   * natural-language terms ("coffee", "pharmacy", "petrol"). Unknown terms throw
   * with suggestions.
   */
  categories?: Array<Category | (string & {})>;
  /** Max results to return after ranking (default 30; <= 0 means no limit). */
  limit?: number;
  /** Preferred language for geocoding results. */
  language?: string;
  /** Override the geocoder (default: Nominatim/OSM). */
  geocoder?: GeocodingProvider;
  /** Override the places provider (default: Overpass/OSM). */
  places?: PlacesProvider;
  /**
   * Composable consumer/accessibility facets (diet, payment, wifi, wheelchair…).
   * A POI must satisfy every active facet; a missing tag means "not a match",
   * never asserted as the feature being absent.
   */
  filters?: FacetFilters;
  /**
   * Accessibility-first ranking: step-free POIs rank above `limited`, above
   * unknown/none, with distance breaking ties within each tier. Ignored when a
   * custom `rank.scoreFn` is supplied.
   */
  accessible?: boolean;
  /**
   * Keep only places open at this time and annotate each result with
   * `openState`/`nextChange`. `'now'` uses the current time; `{ at }` takes an
   * ISO string or Date. Places whose hours are unknown are kept and labelled
   * `unknown` (never silently dropped); only confirmed-closed places are
   * removed. Times are read as the POI's local wall-clock (see {@link isOpenAt}).
   */
  open?: 'now' | { at: string | Date };
  /** Ranking tweaks (category weights or a custom scorer). */
  rank?: RankOptions;
  signal?: AbortSignal;
}

export interface NearbyResult {
  origin: Place;
  results: RankedPoi[];
  /** Number of POIs found before `limit` was applied. */
  total: number;
}

const DEFAULT_RADIUS_M = 1000;
const DEFAULT_LIMIT = 30;

/**
 * Resolve a place name or coordinate to an origin, find surrounding amenities,
 * and rank them by distance. This is the headline entry point of proximap.
 *
 * @param query A place name/address, a "lat,lng" string, or a {@link LatLng}.
 */
export async function findNearbyAmenities(
  query: string | LatLng,
  options: FindNearbyOptions = {},
): Promise<NearbyResult> {
  const radiusMeters = options.radiusMeters ?? DEFAULT_RADIUS_M;
  const geocoder = options.geocoder ?? new NominatimGeocoder();
  const places = options.places ?? new OverpassPlacesProvider();

  const selectors = resolveSelectors(options.categories);
  const origin = await resolveOrigin(query, geocoder, {
    language: options.language,
    signal: options.signal,
  });

  const nearbyOptions: NearbyOptions = { radiusMeters };
  if (selectors.length > 0) nearbyOptions.selectors = selectors;
  if (options.signal) nearbyOptions.signal = options.signal;

  const found = await places.findNearby(origin.location, nearbyOptions);
  let pois =
    selectors.length > 0 ? found.filter((poi) => tagsMatchAnySelector(poi.tags, selectors)) : found;

  if (options.filters) {
    const predicates = compileFacets(options.filters);
    if (predicates.length > 0) pois = pois.filter((poi) => matchesFacets(poi.tags, predicates));
  }

  // Drop confirmed-closed places (keep open + unknown), remembering each
  // evaluation so it can annotate the ranked results below.
  let openEval: Map<string, OpeningEvaluation> | null = null;
  if (options.open) {
    const when = options.open === 'now' ? new Date() : new Date(options.open.at);
    openEval = new Map();
    pois = pois.filter((poi) => {
      const evaluation = isOpenAt(poi.tags.opening_hours, when);
      openEval!.set(poi.id, evaluation);
      return evaluation.state !== 'closed';
    });
  }

  const rankOptions: RankOptions = { radiusMeters, ...options.rank };
  if (options.accessible && !rankOptions.scoreFn) rankOptions.scoreFn = accessibleScorer();

  let ranked = rankByProximity(origin.location, pois, rankOptions);
  if (openEval) {
    ranked = ranked.map((poi) => {
      const evaluation = openEval!.get(poi.id);
      if (!evaluation) return poi;
      const annotated: RankedPoi = { ...poi, openState: evaluation.state };
      if (evaluation.nextChange) annotated.nextChange = evaluation.nextChange;
      return annotated;
    });
  }

  const limit = options.limit ?? DEFAULT_LIMIT;
  const results = limit > 0 ? ranked.slice(0, limit) : ranked;
  return { origin, results, total: ranked.length };
}

/** Resolve requested category terms to selectors, throwing on unknown terms. */
function resolveSelectors(categories: FindNearbyOptions['categories']): CategorySelector[] {
  if (!categories || categories.length === 0) return [];
  const { selectors, unknown } = resolveCategories(categories);
  if (unknown.length > 0) {
    const detail = unknown
      .map((term) => {
        const suggestions = suggestCategories(term);
        return suggestions.length > 0
          ? `"${term}" (did you mean: ${suggestions.join(', ')}?)`
          : `"${term}"`;
      })
      .join('; ');
    throw new Error(`Unknown categor${unknown.length > 1 ? 'ies' : 'y'}: ${detail}`);
  }
  return selectors;
}

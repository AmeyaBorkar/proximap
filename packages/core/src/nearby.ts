import { CATEGORY_LABELS } from './categories';
import { accessibleScorer, compileFacets, matchesFacets, type FacetFilters } from './filters';
import { formatDistance, formatDuration, haversineMeters } from './geo';
import { isOpenAt, type OpeningEvaluation } from './hours';
import { resolveOrigin } from './origin';
import { NominatimGeocoder } from './providers/nominatim';
import { OverpassPlacesProvider } from './providers/overpass';
import { rankByProximity, type RankOptions } from './ranking';
import {
  HaversineRoutingProvider,
  type RouteMetric,
  type RoutingProvider,
  type TravelMode,
} from './routing';
import { resolveCategories, suggestCategories, tagsMatchAnySelector } from './taxonomy';
import type {
  Category,
  CategorySelector,
  GeocodingProvider,
  LatLng,
  NearbyOptions,
  Place,
  PlacesProvider,
  Poi,
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
  /**
   * Order results by straight-line `'distance'` (default) or by `'travelTime'`.
   * Travel-time ranking attaches `travelSeconds`/`travelMeters` to each result.
   */
  rankBy?: 'distance' | 'travelTime';
  /** Travel mode for `rankBy: 'travelTime'` (default `'walk'`). */
  mode?: TravelMode;
  /**
   * Routing engine for travel-time ranking (default: {@link HaversineRoutingProvider},
   * key-free straight-line estimates). Pass a real engine for road-network times;
   * if it errors, ranking falls back to haversine and `result.routing.fellBack` is set.
   */
  routing?: RoutingProvider;
  /** Attach a short `rankingReason` to each result (e.g. "closest open cafe, 240 m"). */
  explain?: boolean;
  /** Ranking tweaks (category weights or a custom scorer). */
  rank?: RankOptions;
  signal?: AbortSignal;
}

export interface NearbyResult {
  origin: Place;
  results: RankedPoi[];
  /** Number of POIs found before `limit` was applied. */
  total: number;
  /** Set when `rankBy: 'travelTime'` was used: which engine answered, and the mode. */
  routing?: { provider: string; mode: TravelMode; fellBack: boolean };
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

  let ranked: RankedPoi[];
  let routingInfo: NearbyResult['routing'];
  if (options.rankBy === 'travelTime') {
    const outcome = await rankByTravelTime(origin.location, pois, {
      mode: options.mode ?? 'walk',
      routing: options.routing ?? new HaversineRoutingProvider(),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    ranked = outcome.ranked;
    routingInfo = outcome.info;
  } else {
    const rankOptions: RankOptions = { radiusMeters, ...options.rank };
    if (options.accessible && !rankOptions.scoreFn) rankOptions.scoreFn = accessibleScorer();
    ranked = rankByProximity(origin.location, pois, rankOptions);
  }

  if (openEval) {
    ranked = ranked.map((poi) => {
      const evaluation = openEval!.get(poi.id);
      if (!evaluation) return poi;
      const annotated: RankedPoi = { ...poi, openState: evaluation.state };
      if (evaluation.nextChange) annotated.nextChange = evaluation.nextChange;
      return annotated;
    });
  }

  if (options.explain) {
    const mode = options.mode ?? 'walk';
    ranked = ranked.map((poi) => ({ ...poi, rankingReason: rankingReasonFor(poi, mode) }));
  }

  const limit = options.limit ?? DEFAULT_LIMIT;
  const results = limit > 0 ? ranked.slice(0, limit) : ranked;
  return {
    origin,
    results,
    total: ranked.length,
    ...(routingInfo ? { routing: routingInfo } : {}),
  };
}

const MODE_ADVERB: Record<TravelMode, string> = {
  walk: 'on foot',
  bike: 'by bike',
  drive: 'by car',
};

/** Ordinal closeness word: 1 → "closest", 2 → "2nd-closest", … */
function ordinalCloseness(rank: number): string {
  if (rank === 1) return 'closest';
  const mod100 = rank % 100;
  const mod10 = rank % 10;
  const suffix =
    mod10 === 1 && mod100 !== 11
      ? 'st'
      : mod10 === 2 && mod100 !== 12
        ? 'nd'
        : mod10 === 3 && mod100 !== 13
          ? 'rd'
          : 'th';
  return `${rank}${suffix}-closest`;
}

/** A short, deterministic explanation of a result's rank, e.g. "closest open cafe, 240 m". */
function rankingReasonFor(poi: RankedPoi, mode: TravelMode): string {
  const what = poi.kind ?? CATEGORY_LABELS[poi.category].toLowerCase();
  const openness = poi.openState === 'open' ? 'open ' : '';
  if (poi.travelSeconds !== undefined) {
    return `${ordinalCloseness(poi.rank)} ${openness}${what} ${MODE_ADVERB[mode]}, ${formatDuration(poi.travelSeconds)}`;
  }
  return `${ordinalCloseness(poi.rank)} ${openness}${what}, ${formatDistance(poi.distanceMeters)}`;
}

/** Cap on candidates sent to a routing matrix — bounds cost and public-engine limits. */
const TRAVEL_MATRIX_CAP = 80;

/**
 * Rank POIs by travel duration. Trims to the nearest {@link TRAVEL_MATRIX_CAP}
 * candidates by straight-line distance first (to bound matrix size), then orders
 * by the routing engine's durations — falling back to haversine if it errors.
 */
async function rankByTravelTime(
  origin: LatLng,
  pois: Poi[],
  options: { mode: TravelMode; routing: RoutingProvider; signal?: AbortSignal },
): Promise<{ ranked: RankedPoi[]; info: NonNullable<NearbyResult['routing']> }> {
  const candidates = [...pois]
    .sort((a, b) => haversineMeters(origin, a.location) - haversineMeters(origin, b.location))
    .slice(0, TRAVEL_MATRIX_CAP);
  const points = candidates.map((poi) => poi.location);
  const requestOptions = options.signal ? { signal: options.signal } : {};

  let metrics: (RouteMetric | null)[];
  let provider = options.routing.name;
  let fellBack = false;
  try {
    metrics = await options.routing.matrix(origin, points, options.mode, requestOptions);
  } catch (error) {
    if (options.routing instanceof HaversineRoutingProvider) throw error;
    const fallback = new HaversineRoutingProvider();
    metrics = await fallback.matrix(origin, points, options.mode);
    provider = fallback.name;
    fellBack = true;
  }

  const reachable = candidates
    .map((poi, index) => ({ poi, metric: metrics[index] ?? null }))
    .filter((entry): entry is { poi: Poi; metric: RouteMetric } => entry.metric !== null)
    .sort((a, b) => a.metric.seconds - b.metric.seconds);

  const slowest = reachable.reduce((max, entry) => Math.max(max, entry.metric.seconds), 0) || 1;
  const ranked: RankedPoi[] = reachable.map((entry, index) => ({
    ...entry.poi,
    distanceMeters: haversineMeters(origin, entry.poi.location),
    score: Math.round((1 - entry.metric.seconds / slowest) * 100) / 100,
    rank: index + 1,
    travelSeconds: entry.metric.seconds,
    travelMeters: entry.metric.meters,
  }));

  return { ranked, info: { provider, mode: options.mode, fellBack } };
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

import { haversineMeters } from './geo';
import { resolveOrigin } from './origin';
import { NominatimGeocoder } from './providers/nominatim';
import { OverpassPlacesProvider } from './providers/overpass';
import {
  HaversineRoutingProvider,
  MODE_SPEED_MPS,
  pointInPolygon,
  type PolygonRing,
  type RouteMetric,
  type RoutingProvider,
  type TravelMode,
} from './routing';
import { resolveCategories, suggestCategories, tagsMatchAnySelector } from './taxonomy';
import type {
  Category,
  GeocodingProvider,
  LatLng,
  NearbyOptions,
  Place,
  PlacesProvider,
  Poi,
  RankedPoi,
} from './types';

export interface ReachableOptions {
  /** Time budget in minutes. */
  within: number;
  /** Travel mode (default `'walk'`). */
  mode?: TravelMode;
  /** Restrict to these categories/terms (default: all amenities). */
  categories?: Array<Category | (string & {})>;
  /**
   * Routing engine (default {@link HaversineRoutingProvider}). A provider with an
   * `isochrone` method gives a true reachability polygon; otherwise membership is
   * decided by a travel-time matrix threshold.
   */
  routing?: RoutingProvider;
  geocoder?: GeocodingProvider;
  places?: PlacesProvider;
  language?: string;
  signal?: AbortSignal;
}

export interface ReachableResult {
  origin: Place;
  withinMinutes: number;
  mode: TravelMode;
  /** The isochrone polygon used ([lng, lat] ring), or null if none was available. */
  isochrone: PolygonRing | null;
  /** Amenities reachable within the budget, soonest first. */
  results: RankedPoi[];
  count: number;
}

/** Don't fetch beyond this radius even for long drive budgets (keeps Overpass sane). */
const MAX_FETCH_RADIUS_M = 15_000;
const REACHABLE_MATRIX_CAP = 100;

/**
 * Return the amenities reachable within a time budget — the *answer*, not just a
 * polygon. With an isochrone-capable engine, membership is the true road-network
 * polygon (point-in-polygon); otherwise it falls back to a travel-time matrix
 * threshold. Results are annotated with travel time and sorted soonest-first.
 */
export async function reachableAmenities(
  query: string | LatLng,
  options: ReachableOptions,
): Promise<ReachableResult> {
  const withinMinutes = options.within;
  if (!(withinMinutes > 0)) {
    throw new Error('reachableAmenities needs a positive `within` (minutes).');
  }
  const mode = options.mode ?? 'walk';
  const routing = options.routing ?? new HaversineRoutingProvider();
  const geocoder = options.geocoder ?? new NominatimGeocoder();
  const places = options.places ?? new OverpassPlacesProvider();
  const budgetSeconds = withinMinutes * 60;

  const selectors = resolveSelectors(options.categories);
  const origin = await resolveOrigin(query, geocoder, {
    language: options.language,
    signal: options.signal,
  });

  // Straight-line reach is an upper bound on what any route could cover.
  const fetchRadius = Math.min(
    Math.round(MODE_SPEED_MPS[mode] * budgetSeconds),
    MAX_FETCH_RADIUS_M,
  );
  const nearbyOptions: NearbyOptions = { radiusMeters: fetchRadius };
  if (selectors.length > 0) nearbyOptions.selectors = selectors;
  if (options.signal) nearbyOptions.signal = options.signal;
  const found = await places.findNearby(origin.location, nearbyOptions);
  const pois =
    selectors.length > 0 ? found.filter((poi) => tagsMatchAnySelector(poi.tags, selectors)) : found;

  const isochrone = await tryIsochrone(
    routing,
    origin.location,
    withinMinutes,
    mode,
    options.signal,
  );

  // With a polygon, membership is point-in-polygon; otherwise a matrix threshold.
  const candidates = isochrone
    ? pois.filter((poi) => pointInPolygon(poi.location, isochrone))
    : pois;
  const nearest = [...candidates]
    .sort(
      (a, b) =>
        haversineMeters(origin.location, a.location) - haversineMeters(origin.location, b.location),
    )
    .slice(0, REACHABLE_MATRIX_CAP);

  const metrics = await safeMatrix(routing, origin.location, nearest, mode, options.signal);
  const members = nearest
    .map((poi, index) => ({ poi, metric: metrics[index] ?? null }))
    .filter((entry) => isochrone !== null || withinBudget(entry.metric, budgetSeconds));

  members.sort(
    (a, b) =>
      (a.metric?.seconds ?? Infinity) - (b.metric?.seconds ?? Infinity) ||
      haversineMeters(origin.location, a.poi.location) -
        haversineMeters(origin.location, b.poi.location),
  );

  const results: RankedPoi[] = members.map((entry, index) => {
    const ranked: RankedPoi = {
      ...entry.poi,
      distanceMeters: haversineMeters(origin.location, entry.poi.location),
      // Clamp to [0, 1]: an isochrone can enclose a POI whose matrix travel
      // time still exceeds the budget, which would otherwise score negative.
      score: entry.metric
        ? Math.max(0, Math.round((1 - entry.metric.seconds / budgetSeconds) * 100) / 100)
        : 0,
      rank: index + 1,
    };
    if (entry.metric) {
      ranked.travelSeconds = entry.metric.seconds;
      ranked.travelMeters = entry.metric.meters;
    }
    return ranked;
  });

  return { origin, withinMinutes, mode, isochrone, results, count: results.length };
}

function withinBudget(metric: RouteMetric | null, budgetSeconds: number): boolean {
  return metric !== null && metric.seconds <= budgetSeconds;
}

async function tryIsochrone(
  routing: RoutingProvider,
  origin: LatLng,
  minutes: number,
  mode: TravelMode,
  signal: AbortSignal | undefined,
): Promise<PolygonRing | null> {
  if (!routing.isochrone) return null;
  try {
    return await routing.isochrone(origin, minutes, mode, signal ? { signal } : {});
  } catch {
    return null; // best-effort; fall back to the matrix-threshold path
  }
}

async function safeMatrix(
  routing: RoutingProvider,
  origin: LatLng,
  pois: Poi[],
  mode: TravelMode,
  signal: AbortSignal | undefined,
): Promise<(RouteMetric | null)[]> {
  if (pois.length === 0) return [];
  const points = pois.map((poi) => poi.location);
  try {
    return await routing.matrix(origin, points, mode, signal ? { signal } : {});
  } catch {
    if (routing instanceof HaversineRoutingProvider) return points.map(() => null);
    return new HaversineRoutingProvider().matrix(origin, points, mode);
  }
}

/** Resolve category terms to selectors, throwing on unknown terms with suggestions. */
function resolveSelectors(categories: ReachableOptions['categories']) {
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

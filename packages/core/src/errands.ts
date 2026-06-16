import { haversineMeters } from './geo';
import { resolveOrigin } from './origin';
import { NominatimGeocoder } from './providers/nominatim';
import { OverpassPlacesProvider } from './providers/overpass';
import {
  HaversineRoutingProvider,
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
} from './types';

export interface ErrandOptions {
  /** Categories/terms to hit one of each, e.g. ['pharmacy', 'atm', 'grocery']. */
  categories: Array<Category | (string & {})>;
  /** Travel mode for the cost matrix (default `'walk'`). */
  mode?: TravelMode;
  /** Optional fixed end point (a place name, "lat,lng", or coordinate). */
  end?: string | LatLng;
  /** Nearest candidates considered per category (default 5). */
  candidatesPerCategory?: number;
  /** How far to look for candidates, in metres (default 3000). */
  searchRadiusMeters?: number;
  /**
   * Cost engine for the matrix (default {@link HaversineRoutingProvider} — an
   * honest, instant, key-free straight-line MVP). Pass a real engine for road
   * times; note it issues one matrix request per point.
   */
  routing?: RoutingProvider;
  geocoder?: GeocodingProvider;
  places?: PlacesProvider;
  language?: string;
  signal?: AbortSignal;
}

export interface ErrandStop {
  category: string;
  poi: Poi;
  /** Leg from the previous point (origin or prior stop) to this stop. */
  legSeconds: number;
  legMeters: number;
}

export interface ErrandPlan {
  origin: Place;
  end: Place | null;
  mode: TravelMode;
  /** Chosen places in visit order. */
  stops: ErrandStop[];
  totalSeconds: number;
  totalMeters: number;
  /** Requested categories with no candidate nearby — skipped, not faked. */
  missing: string[];
  candidatesPerCategory: number;
}

const DEFAULT_CANDIDATES = 5;
const DEFAULT_SEARCH_RADIUS_M = 3000;
/** Upper bound on distinct categories for the exact DP (2^C states). */
const MAX_CATEGORIES = 12;

/**
 * Plan the shortest trip that buys/visits one of each requested category near an
 * origin — the **Generalized TSP** ("pick one per set, then optimize") that no
 * consumer app ships. Fetches the nearest candidates per category, builds a cost
 * matrix, and solves exactly via a grouped Held-Karp DP (instant at consumer
 * scale). Categories with no candidate are reported as `missing`, never faked.
 */
export async function planErrands(
  query: string | LatLng,
  options: ErrandOptions,
): Promise<ErrandPlan> {
  const terms = options.categories ?? [];
  if (terms.length === 0) throw new Error('planErrands needs at least one category.');
  if (terms.length > MAX_CATEGORIES) {
    throw new Error(
      `planErrands supports up to ${MAX_CATEGORIES} categories (got ${terms.length}).`,
    );
  }
  const mode = options.mode ?? 'walk';
  const perCategory = options.candidatesPerCategory ?? DEFAULT_CANDIDATES;
  const searchRadiusMeters = options.searchRadiusMeters ?? DEFAULT_SEARCH_RADIUS_M;
  const routing = options.routing ?? new HaversineRoutingProvider();
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
  const end = options.end !== undefined ? await resolveEnd(options.end, geocoder, options) : null;

  // One fetch over the union, then take the nearest K per category.
  const nearbyOptions: NearbyOptions = {
    radiusMeters: searchRadiusMeters,
    selectors: resolved.selectors,
  };
  if (options.signal) nearbyOptions.signal = options.signal;
  const pois = await places.findNearby(origin.location, nearbyOptions);

  const missing: string[] = [];
  const groups: { term: string; candidates: Poi[] }[] = [];
  for (const term of terms) {
    const selectors = resolveCategories([term]).selectors;
    const candidates = pois
      .filter((poi) => tagsMatchAnySelector(poi.tags, selectors))
      .sort(
        (a, b) =>
          haversineMeters(origin.location, a.location) -
          haversineMeters(origin.location, b.location),
      )
      .slice(0, perCategory);
    if (candidates.length === 0) missing.push(String(term));
    else groups.push({ term: String(term), candidates });
  }

  if (groups.length === 0) {
    return {
      origin,
      end,
      mode,
      stops: [],
      totalSeconds: 0,
      totalMeters: 0,
      missing,
      candidatesPerCategory: perCategory,
    };
  }

  const solution = await solveGeneralizedTsp(
    origin.location,
    groups,
    end?.location ?? null,
    mode,
    routing,
  );
  return {
    origin,
    end,
    mode,
    stops: solution.stops,
    totalSeconds: solution.totalSeconds,
    totalMeters: solution.totalMeters,
    missing,
    candidatesPerCategory: perCategory,
  };
}

interface FlatNode {
  group: number;
  term: string;
  poi: Poi;
}

/** Exact grouped Held-Karp: visit one node per group, origin-anchored, optional fixed end. */
async function solveGeneralizedTsp(
  origin: LatLng,
  groups: { term: string; candidates: Poi[] }[],
  end: LatLng | null,
  mode: TravelMode,
  routing: RoutingProvider,
): Promise<{ stops: ErrandStop[]; totalSeconds: number; totalMeters: number }> {
  const nodes: FlatNode[] = [];
  groups.forEach((group, groupIndex) => {
    for (const poi of group.candidates) nodes.push({ group: groupIndex, term: group.term, poi });
  });

  // points: 0 = origin, 1..N = nodes, optional last = end.
  const points: LatLng[] = [origin, ...nodes.map((node) => node.poi.location)];
  const endPointIndex = end ? points.push(end) - 1 : -1;
  const matrix = await buildCostMatrix(points, mode, routing);
  const seconds = (from: number, to: number): number => matrix[from]![to]!.seconds;

  const groupCount = groups.length;
  const nodeCount = nodes.length;
  const full = (1 << groupCount) - 1;
  const cost: number[][] = Array.from({ length: 1 << groupCount }, () =>
    new Array(nodeCount).fill(Infinity),
  );
  const parent: number[][] = Array.from({ length: 1 << groupCount }, () =>
    new Array(nodeCount).fill(-1),
  );

  for (let n = 0; n < nodeCount; n++) {
    cost[1 << nodes[n]!.group]![n] = seconds(0, n + 1);
  }
  for (let mask = 1; mask <= full; mask++) {
    const row = cost[mask]!;
    for (let n = 0; n < nodeCount; n++) {
      const here = row[n]!;
      if (here === Infinity || !(mask & (1 << nodes[n]!.group))) continue;
      for (let m = 0; m < nodeCount; m++) {
        const groupBit = 1 << nodes[m]!.group;
        if (mask & groupBit) continue; // that group already visited
        const nextMask = mask | groupBit;
        const candidate = here + seconds(n + 1, m + 1);
        if (candidate < cost[nextMask]![m]!) {
          cost[nextMask]![m] = candidate;
          parent[nextMask]![m] = n;
        }
      }
    }
  }

  let best = Infinity;
  let lastNode = -1;
  for (let n = 0; n < nodeCount; n++) {
    let total = cost[full]![n]!;
    if (total === Infinity) continue;
    if (endPointIndex >= 0) total += seconds(n + 1, endPointIndex);
    if (total < best) {
      best = total;
      lastNode = n;
    }
  }

  // Reconstruct the visit order.
  const order: number[] = [];
  let mask = full;
  let node = lastNode;
  while (node !== -1) {
    order.push(node);
    const previous = parent[mask]![node]!;
    mask &= ~(1 << nodes[node]!.group);
    node = previous;
  }
  order.reverse();

  const stops: ErrandStop[] = [];
  let previousPoint = 0; // origin
  let totalMeters = 0;
  for (const n of order) {
    const leg = matrix[previousPoint]![n + 1]!;
    totalMeters += leg.meters;
    stops.push({
      category: nodes[n]!.term,
      poi: nodes[n]!.poi,
      legSeconds: leg.seconds,
      legMeters: leg.meters,
    });
    previousPoint = n + 1;
  }
  if (endPointIndex >= 0) totalMeters += matrix[previousPoint]![endPointIndex]!.meters;

  return { stops, totalSeconds: best === Infinity ? 0 : best, totalMeters };
}

/** Build a full point-to-point cost matrix (one matrix request per source point). */
async function buildCostMatrix(
  points: LatLng[],
  mode: TravelMode,
  routing: RoutingProvider,
): Promise<RouteMetric[][]> {
  const rows: RouteMetric[][] = [];
  for (const source of points) {
    const row = await routing.matrix(source, points, mode);
    rows.push(row.map((metric) => metric ?? { seconds: Infinity, meters: Infinity }));
  }
  return rows;
}

async function resolveEnd(
  end: string | LatLng,
  geocoder: GeocodingProvider,
  options: ErrandOptions,
): Promise<Place> {
  return resolveOrigin(end, geocoder, {
    language: options.language,
    signal: options.signal,
  });
}

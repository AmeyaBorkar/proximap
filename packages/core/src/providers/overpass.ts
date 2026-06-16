import { categorize } from '../categories';
import {
  DEFAULT_USER_AGENT,
  HttpError,
  RateLimiter,
  requestJson,
  type RequestCache,
} from '../http';
import { completenessOf, dedupePois, lastVerifiedOf } from '../quality';
import { selectorToOverpassFilter } from '../taxonomy';
import type { CategorySelector, LatLng, NearbyOptions, PlacesProvider, Poi } from '../types';

export interface OverpassOptions {
  /** Overpass interpreter endpoint URL. */
  endpoint?: string;
  /** Contact User-Agent sent with each request. */
  userAgent?: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
  /** Minimum spacing between requests in ms (default 1000). */
  minIntervalMs?: number;
  /** Retry attempts on transient failures (default 2). */
  retries?: number;
  /** Optional response cache (opt-in). */
  cache?: RequestCache;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  /** Last-edit time, present when the query requests `meta`. */
  timestamp?: string;
}

interface OverpassResponse {
  elements?: OverpassElement[];
  /** Present when Overpass reports a runtime error/timeout (often with HTTP 200). */
  remark?: string;
}

/** Tag selectors fetched around the search center. Mirrors `categorize`. */
const SELECTORS = [
  'nwr["amenity"]',
  'nwr["shop"]',
  'nwr["tourism"]',
  'nwr["leisure"]',
  'nwr["healthcare"]',
  'nwr["office"="government"]',
  'nwr["railway"~"^(station|halt|tram_stop|subway_entrance|stop)$"]',
  'nwr["public_transport"="station"]',
  'node["highway"="bus_stop"]',
  'nwr["aeroway"="aerodrome"]',
];

/** Build the Overpass QL query for all relevant POIs within `radiusMeters`. */
export function buildOverpassQuery(center: LatLng, radiusMeters: number): string {
  const around = `around:${Math.max(1, Math.round(radiusMeters))},${center.lat},${center.lng}`;
  const body = SELECTORS.map((selector) => `  ${selector}(${around});`).join('\n');
  return `[out:json][timeout:25];\n(\n${body}\n);\nout center tags meta;`;
}

/** Build an Overpass query that fetches only features matching `selectors`. */
export function buildTargetedOverpassQuery(
  center: LatLng,
  radiusMeters: number,
  selectors: CategorySelector[],
): string {
  const around = `around:${Math.max(1, Math.round(radiusMeters))},${center.lat},${center.lng}`;
  const body = selectors
    .map((selector) => `  nwr${selectorToOverpassFilter(selector)}(${around});`)
    .join('\n');
  return `[out:json][timeout:25];\n(\n${body}\n);\nout center tags meta;`;
}

function coordOf(lat: number | undefined, lon: number | undefined): LatLng | null {
  if (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  ) {
    return { lat, lng: lon };
  }
  return null;
}

/**
 * Nearby-places search via the Overpass API over OpenStreetMap data. Fetches
 * every relevant feature within the radius, classifies it, and (optionally)
 * filters by category — distance ranking happens upstream.
 */
export class OverpassPlacesProvider implements PlacesProvider {
  readonly name = 'overpass';
  private readonly endpoint: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly cache: RequestCache | undefined;
  private readonly limiter: RateLimiter;

  constructor(options: OverpassOptions = {}) {
    this.endpoint = options.endpoint ?? 'https://overpass-api.de/api/interpreter';
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.retries = options.retries ?? 2;
    this.cache = options.cache;
    this.limiter = new RateLimiter(options.minIntervalMs ?? 1000);
  }

  async findNearby(center: LatLng, options: NearbyOptions): Promise<Poi[]> {
    const query =
      options.selectors && options.selectors.length > 0
        ? buildTargetedOverpassQuery(center, options.radiusMeters, options.selectors)
        : buildOverpassQuery(center, options.radiusMeters);
    await this.limiter.acquire();
    const data = await requestJson<OverpassResponse>(this.endpoint, {
      method: 'POST',
      headers: {
        'User-Agent': this.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
      timeoutMs: this.timeoutMs,
      retries: this.retries,
      ...(this.cache ? { cache: this.cache } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (data.remark && /error|timed out|rate_limited|too many|memory/i.test(data.remark)) {
      throw new HttpError(0, this.endpoint, `Overpass: ${data.remark}`);
    }

    const wanted = options.categories ? new Set(options.categories) : null;
    const pois: Poi[] = [];
    for (const element of data.elements ?? []) {
      const poi = this.toPoi(element);
      if (!poi) continue;
      if (wanted && !wanted.has(poi.category)) continue;
      pois.push(poi);
    }
    return dedupePois(pois);
  }

  private toPoi(element: OverpassElement): Poi | null {
    const tags = element.tags;
    if (!tags) return null;
    const coords =
      element.type === 'node'
        ? coordOf(element.lat, element.lon)
        : element.center
          ? coordOf(element.center.lat, element.center.lon)
          : null;
    if (!coords) return null;

    const { category, kind } = categorize(tags);
    const poi: Poi = {
      id: `${element.type}/${element.id}`,
      category,
      location: coords,
      tags,
      source: this.name,
    };
    if (tags.name) poi.name = tags.name;
    if (kind) poi.kind = kind;
    poi.completeness = completenessOf(category, tags);
    const lastVerified = lastVerifiedOf(tags, element.timestamp);
    if (lastVerified) poi.lastVerified = lastVerified;
    return poi;
  }
}

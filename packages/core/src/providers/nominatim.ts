import { DEFAULT_USER_AGENT, RateLimiter, requestJson, type RequestCache } from '../http';
import type { GeocodeOptions, GeocodingProvider, LatLng, Place } from '../types';

export interface NominatimOptions {
  /** Base URL of the Nominatim instance (no trailing slash required). */
  endpoint?: string;
  /** Contact User-Agent, required by the public OSM instance's usage policy. */
  userAgent?: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
  /** Minimum spacing between requests in ms (default 1000, per OSM policy). */
  minIntervalMs?: number;
  /** Retry attempts on transient failures (default 2). */
  retries?: number;
  /** Optional response cache (opt-in). */
  cache?: RequestCache;
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  class?: string;
  type?: string;
  /** Nominatim's relevance heuristic in [0, 1]; not correctness — used for ambiguity. */
  importance?: number;
  /** [south, north, west, east] as strings. */
  boundingbox?: [string, string, string, string];
}

/**
 * Geocoding via Nominatim (OpenStreetMap). Free and key-less; please honour the
 * usage policy (max ~1 req/s, valid User-Agent) or point `endpoint` at your own
 * instance for production traffic.
 */
export class NominatimGeocoder implements GeocodingProvider {
  readonly name = 'nominatim';
  private readonly endpoint: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number | undefined;
  private readonly retries: number;
  private readonly cache: RequestCache | undefined;
  private readonly limiter: RateLimiter;

  constructor(options: NominatimOptions = {}) {
    this.endpoint = (options.endpoint ?? 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.timeoutMs = options.timeoutMs;
    this.retries = options.retries ?? 2;
    this.cache = options.cache;
    this.limiter = new RateLimiter(options.minIntervalMs ?? 1000);
  }

  async geocode(query: string, options: GeocodeOptions = {}): Promise<Place[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: String(options.limit ?? 5),
    });
    if (options.language) params.set('accept-language', options.language);
    const results = await this.request<NominatimResult[]>(`/search?${params}`, options.signal);
    return results.map((result) => this.toPlace(result));
  }

  async reverse(location: LatLng, options: GeocodeOptions = {}): Promise<Place | null> {
    const params = new URLSearchParams({
      lat: String(location.lat),
      lon: String(location.lng),
      format: 'jsonv2',
    });
    if (options.language) params.set('accept-language', options.language);
    const result = await this.request<NominatimResult | { error: unknown }>(
      `/reverse?${params}`,
      options.signal,
    );
    if (!result || 'error' in result) return null;
    return this.toPlace(result);
  }

  private async request<T>(path: string, signal: AbortSignal | undefined): Promise<T> {
    await this.limiter.acquire();
    return requestJson<T>(`${this.endpoint}${path}`, {
      headers: { 'User-Agent': this.userAgent },
      retries: this.retries,
      ...(this.cache ? { cache: this.cache } : {}),
      ...(signal ? { signal } : {}),
      ...(this.timeoutMs ? { timeoutMs: this.timeoutMs } : {}),
    });
  }

  private toPlace(result: NominatimResult): Place {
    const fallbackName = result.display_name.split(',')[0]?.trim() ?? result.display_name;
    const place: Place = {
      name: result.name && result.name.length > 0 ? result.name : fallbackName,
      displayName: result.display_name,
      location: { lat: Number(result.lat), lng: Number(result.lon) },
      source: this.name,
      raw: result,
    };
    const kind = result.type ?? result.class;
    if (kind) place.kind = kind;
    if (result.boundingbox) {
      const [s, n, w, e] = result.boundingbox;
      place.boundingBox = [Number(s), Number(n), Number(w), Number(e)];
    }
    return place;
  }
}

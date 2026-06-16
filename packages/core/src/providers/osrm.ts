import { DEFAULT_USER_AGENT, RateLimiter, requestJson, type RequestCache } from '../http';
import type { RouteMetric, RoutingProvider, RoutingRequestOptions, TravelMode } from '../routing';
import type { LatLng } from '../types';

/** proximap travel modes → OSRM profiles (self-hosted; the public demo is car-only). */
const PROFILE: Record<TravelMode, string> = { walk: 'foot', bike: 'bike', drive: 'driving' };

export interface OsrmOptions {
  /** Base URL of the OSRM instance (default: the public demo server). */
  endpoint?: string;
  userAgent?: string;
  timeoutMs?: number;
  minIntervalMs?: number;
  retries?: number;
  cache?: RequestCache;
}

interface TableResponse {
  code: string;
  /** durations[i][j] seconds; sources=0 ⇒ durations[0] is origin→each coordinate. */
  durations?: (number | null)[][];
  distances?: (number | null)[][];
}

/**
 * Travel-time matrices via OSRM's Table service. The public demo server
 * (`router.project-osrm.org`) only offers the car profile; for walk/bike,
 * point `endpoint` at a self-hosted OSRM with the matching profile. Matrix only —
 * OSRM has no isochrone service (use {@link ValhallaRoutingProvider} for that).
 */
export class OsrmRoutingProvider implements RoutingProvider {
  readonly name = 'osrm';
  private readonly endpoint: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number | undefined;
  private readonly retries: number;
  private readonly cache: RequestCache | undefined;
  private readonly limiter: RateLimiter;

  constructor(options: OsrmOptions = {}) {
    this.endpoint = (options.endpoint ?? 'https://router.project-osrm.org').replace(/\/+$/, '');
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.timeoutMs = options.timeoutMs;
    this.retries = options.retries ?? 1;
    this.cache = options.cache;
    this.limiter = new RateLimiter(options.minIntervalMs ?? 1000);
  }

  async matrix(
    origin: LatLng,
    targets: readonly LatLng[],
    mode: TravelMode,
    options: RoutingRequestOptions = {},
  ): Promise<(RouteMetric | null)[]> {
    if (targets.length === 0) return [];
    const coordinates = [origin, ...targets].map((c) => `${c.lng},${c.lat}`).join(';');
    const params = new URLSearchParams({ sources: '0', annotations: 'duration,distance' });
    const url = `${this.endpoint}/table/v1/${PROFILE[mode]}/${coordinates}?${params}`;

    await this.limiter.acquire();
    const data = await requestJson<TableResponse>(url, {
      headers: { 'User-Agent': this.userAgent },
      retries: this.retries,
      ...(this.cache ? { cache: this.cache } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(this.timeoutMs ? { timeoutMs: this.timeoutMs } : {}),
    });

    const durations = data.durations?.[0] ?? [];
    const distances = data.distances?.[0] ?? [];
    return targets.map((_, index) => {
      const seconds = durations[index + 1]; // index 0 is the origin→origin self-pair
      if (seconds === null || seconds === undefined) return null;
      const meters = distances[index + 1];
      return { seconds: Math.round(seconds), meters: meters == null ? 0 : Math.round(meters) };
    });
  }
}

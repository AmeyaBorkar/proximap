import {
  DEFAULT_USER_AGENT,
  HttpError,
  RateLimiter,
  requestJson,
  type RequestCache,
} from '../http';
import type {
  PolygonRing,
  RouteMetric,
  RoutingProvider,
  RoutingRequestOptions,
  TravelMode,
} from '../routing';
import type { LatLng } from '../types';

/** proximap travel modes → Valhalla costing models. */
const COSTING: Record<TravelMode, string> = {
  walk: 'pedestrian',
  bike: 'bicycle',
  drive: 'auto',
};

export interface ValhallaOptions {
  /** Base URL of the Valhalla instance (default: the key-free FOSSGIS instance). */
  endpoint?: string;
  userAgent?: string;
  timeoutMs?: number;
  /** Minimum spacing between requests in ms (default 1000). */
  minIntervalMs?: number;
  retries?: number;
  cache?: RequestCache;
}

interface MatrixCell {
  distance: number | null; // kilometres
  time: number | null; // seconds
  to_index: number;
  from_index: number;
}
interface MatrixResponse {
  sources_to_targets?: MatrixCell[][];
  error?: string;
}
interface IsochroneResponse {
  features?: { geometry?: { type: string; coordinates: unknown } }[];
  error?: string;
}

/**
 * Routing via Valhalla. Defaults to the **key-free** public FOSSGIS instance,
 * which supports pedestrian/bicycle/auto matrices and real isochrone polygons —
 * please honour its ~1 req/s fair-use policy or self-host for volume.
 */
export class ValhallaRoutingProvider implements RoutingProvider {
  readonly name = 'valhalla';
  private readonly endpoint: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number | undefined;
  private readonly retries: number;
  private readonly cache: RequestCache | undefined;
  private readonly limiter: RateLimiter;

  constructor(options: ValhallaOptions = {}) {
    this.endpoint = (options.endpoint ?? 'https://valhalla1.openstreetmap.de').replace(/\/+$/, '');
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
    const body = JSON.stringify({
      sources: [{ lat: origin.lat, lon: origin.lng }],
      targets: targets.map((target) => ({ lat: target.lat, lon: target.lng })),
      costing: COSTING[mode],
    });
    const data = await this.post<MatrixResponse>('/sources_to_targets', body, options.signal);
    if (data.error) throw new HttpError(0, this.endpoint, `Valhalla: ${data.error}`);

    const row = data.sources_to_targets?.[0] ?? [];
    const metrics: (RouteMetric | null)[] = targets.map(() => null);
    for (const cell of row) {
      if (cell.time === null || cell.distance === null) continue;
      if (cell.to_index < 0 || cell.to_index >= metrics.length) continue;
      metrics[cell.to_index] = {
        seconds: Math.round(cell.time),
        meters: Math.round(cell.distance * 1000),
      };
    }
    return metrics;
  }

  async isochrone(
    origin: LatLng,
    minutes: number,
    mode: TravelMode,
    options: RoutingRequestOptions = {},
  ): Promise<PolygonRing> {
    const body = JSON.stringify({
      locations: [{ lat: origin.lat, lon: origin.lng }],
      costing: COSTING[mode],
      contours: [{ time: minutes }],
      polygons: true,
    });
    const data = await this.post<IsochroneResponse>('/isochrone', body, options.signal);
    if (data.error) throw new HttpError(0, this.endpoint, `Valhalla: ${data.error}`);
    const ring = extractRing(data.features ?? []);
    if (!ring) throw new HttpError(0, this.endpoint, 'Valhalla: no isochrone polygon returned');
    return ring;
  }

  private async post<T>(path: string, body: string, signal: AbortSignal | undefined): Promise<T> {
    await this.limiter.acquire();
    return requestJson<T>(`${this.endpoint}${path}`, {
      method: 'POST',
      headers: { 'User-Agent': this.userAgent, 'Content-Type': 'application/json' },
      body,
      retries: this.retries,
      ...(this.cache ? { cache: this.cache } : {}),
      ...(signal ? { signal } : {}),
      ...(this.timeoutMs ? { timeoutMs: this.timeoutMs } : {}),
    });
  }
}

/** Pull the outer ring out of a Valhalla isochrone FeatureCollection (Polygon/MultiPolygon). */
function extractRing(
  features: { geometry?: { type: string; coordinates: unknown } }[],
): PolygonRing | null {
  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    const coords = geometry.coordinates;
    if (geometry.type === 'LineString' && isRing(coords)) return coords;
    if (geometry.type === 'Polygon' && Array.isArray(coords) && isRing(coords[0])) {
      return coords[0];
    }
    if (
      geometry.type === 'MultiPolygon' &&
      Array.isArray(coords) &&
      Array.isArray(coords[0]) &&
      isRing(coords[0][0])
    ) {
      return coords[0][0];
    }
  }
  return null;
}

function isRing(value: unknown): value is PolygonRing {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.every(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        typeof point[0] === 'number' &&
        typeof point[1] === 'number',
    )
  );
}

import { haversineMeters } from './geo';
import type { LatLng } from './types';

/** How a route is travelled. Maps to engine-specific profiles per adapter. */
export type TravelMode = 'walk' | 'bike' | 'drive';

export interface RouteMetric {
  /** Travel duration in seconds. */
  seconds: number;
  /** Travel distance in metres. */
  meters: number;
}

/** A polygon ring as [longitude, latitude] pairs (GeoJSON order). */
export type PolygonRing = [number, number][];

export interface RoutingRequestOptions {
  signal?: AbortSignal;
}

/**
 * Routing is a commodity (OSRM/Valhalla/ORS self-host it); proximap's value is
 * *composing* it with the amenity layer. This is the seam: a one-to-many matrix
 * and an optional isochrone, with adapters for real engines and a haversine
 * fallback so everything degrades gracefully and works key-free out of the box.
 */
export interface RoutingProvider {
  readonly name: string;
  /** Durations/distances from one origin to many targets, aligned with `targets` (null = unreachable). */
  matrix(
    origin: LatLng,
    targets: readonly LatLng[],
    mode: TravelMode,
    options?: RoutingRequestOptions,
  ): Promise<(RouteMetric | null)[]>;
  /** Polygon reachable within `minutes`. Optional — absent ⇒ callers fall back to a matrix threshold. */
  isochrone?(
    origin: LatLng,
    minutes: number,
    mode: TravelMode,
    options?: RoutingRequestOptions,
  ): Promise<PolygonRing>;
}

/** Typical speeds (m/s) for the haversine fallback: ~5, ~15, ~40 km/h. */
export const MODE_SPEED_MPS: Record<TravelMode, number> = { walk: 1.4, bike: 4.2, drive: 11.1 };

/**
 * Straight-line routing: distance via haversine, duration via a per-mode speed,
 * isochrone as a circle. The key-free, network-free default — a floor that always
 * works; pass a real {@link RoutingProvider} (Valhalla/OSRM) for road accuracy.
 */
export class HaversineRoutingProvider implements RoutingProvider {
  readonly name = 'haversine';

  async matrix(
    origin: LatLng,
    targets: readonly LatLng[],
    mode: TravelMode,
  ): Promise<RouteMetric[]> {
    const speed = MODE_SPEED_MPS[mode];
    return targets.map((target) => {
      const meters = haversineMeters(origin, target);
      return { meters: Math.round(meters), seconds: Math.round(meters / speed) };
    });
  }

  async isochrone(origin: LatLng, minutes: number, mode: TravelMode): Promise<PolygonRing> {
    return circlePolygon(origin, MODE_SPEED_MPS[mode] * minutes * 60);
  }
}

/** Approximate a circle of `radiusMeters` around `center` as a polygon ring ([lng, lat]). */
export function circlePolygon(center: LatLng, radiusMeters: number, steps = 48): PolygonRing {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  const ring: PolygonRing = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    ring.push([center.lng + lngDelta * Math.cos(angle), center.lat + latDelta * Math.sin(angle)]);
  }
  return ring;
}

/** Ray-casting point-in-polygon test; `ring` is [lng, lat] pairs. */
export function pointInPolygon(point: LatLng, ring: PolygonRing): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    const intersect =
      a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0];
    if (intersect) inside = !inside;
  }
  return inside;
}

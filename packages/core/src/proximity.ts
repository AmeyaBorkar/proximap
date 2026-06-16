import { haversineMeters } from './geo';
import { tagsMatchAnySelector } from './taxonomy';
import type { CategorySelector, LatLng, Poi } from './types';

/** The closest POI matching a selector set, with its distance from an origin. */
export interface NearestMatch {
  /** Distance to the nearest match in metres, or null if none matched. */
  meters: number | null;
  /** The nearest matching POI, or null if none matched. */
  poi: Poi | null;
}

/**
 * Find the nearest POI to `origin` whose tags satisfy any of `selectors`.
 * Shared by the gap and walkability features; returns nulls (never throws)
 * when nothing matches, so callers can frame absence honestly.
 */
export function nearestMatchingPoi(
  origin: LatLng,
  pois: readonly Poi[],
  selectors: readonly CategorySelector[],
): NearestMatch {
  let bestMeters: number | null = null;
  let bestPoi: Poi | null = null;
  for (const poi of pois) {
    if (!tagsMatchAnySelector(poi.tags, selectors)) continue;
    const meters = haversineMeters(origin, poi.location);
    if (bestMeters === null || meters < bestMeters) {
      bestMeters = meters;
      bestPoi = poi;
    }
  }
  return { meters: bestMeters, poi: bestPoi };
}

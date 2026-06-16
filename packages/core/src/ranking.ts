import { haversineMeters } from './geo';
import type { Category, LatLng, Poi, RankedPoi } from './types';

/** Inputs handed to a scorer for a single POI. */
export interface ScoreInput {
  poi: Poi;
  distanceMeters: number;
  /** Radius used to normalize distance into a [0, 1] proximity. */
  radiusMeters: number;
}

export interface RankOptions {
  /** Per-category multipliers applied to the base score (default 1 each). */
  categoryWeights?: Partial<Record<Category, number>>;
  /** Custom scorer (higher = better); overrides the default proximity scorer. */
  scoreFn?: (input: ScoreInput) => number;
  /** Distance normalization radius; defaults to the farthest POI found. */
  radiusMeters?: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

function defaultScorer(weights?: Partial<Record<Category, number>>): (input: ScoreInput) => number {
  return ({ poi, distanceMeters, radiusMeters }) => {
    const proximity = 1 - clamp01(distanceMeters / radiusMeters);
    const completeness = poi.name ? 0.05 : 0;
    const weight = weights?.[poi.category] ?? 1;
    return (proximity + completeness) * weight;
  };
}

/**
 * Rank POIs by proximity to `origin`. By default results are ordered nearest
 * first; supplying `categoryWeights` or a custom `scoreFn` switches to
 * highest-score first (ties broken by distance). Each result gains its
 * great-circle `distanceMeters`, a `score` in [0, 1], and a 1-based `rank`.
 */
export function rankByProximity(
  origin: LatLng,
  pois: Poi[],
  options: RankOptions = {},
): RankedPoi[] {
  if (pois.length === 0) return [];

  const measured = pois.map((poi) => ({
    poi,
    distanceMeters: haversineMeters(origin, poi.location),
  }));
  const maxDistance = measured.reduce((max, m) => Math.max(max, m.distanceMeters), 0);
  const radiusMeters = options.radiusMeters ?? Math.max(maxDistance, 1);
  const score = options.scoreFn ?? defaultScorer(options.categoryWeights);

  const scored = measured.map(({ poi, distanceMeters }) => ({
    poi,
    distanceMeters,
    score: clamp01(score({ poi, distanceMeters, radiusMeters })),
  }));

  const byScore = Boolean(options.scoreFn || options.categoryWeights);
  scored.sort((a, b) =>
    byScore
      ? b.score - a.score || a.distanceMeters - b.distanceMeters
      : a.distanceMeters - b.distanceMeters,
  );

  return scored.map((entry, index) => ({
    ...entry.poi,
    distanceMeters: entry.distanceMeters,
    score: entry.score,
    rank: index + 1,
  }));
}

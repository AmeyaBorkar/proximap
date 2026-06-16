import { haversineMeters } from './geo';
import { NominatimGeocoder } from './providers/nominatim';
import type { GeocodingProvider, Place } from './types';

export interface DisambiguateOptions {
  geocoder?: GeocodingProvider;
  /** How many candidates to fetch/return (default 5). */
  limit?: number;
  language?: string;
  signal?: AbortSignal;
}

export interface Disambiguation {
  query: string;
  /**
   * True when several plausible, geographically distinct candidates exist (e.g.
   * the ~90 US "Springfield"s). Callers should present `candidates` rather than
   * silently trusting `best`, since geocoder relevance is not correctness.
   */
  ambiguous: boolean;
  /** The top-ranked candidate (the geocoder's best guess), or null if none. */
  best: Place | null;
  /** Ranked candidates to disambiguate between. */
  candidates: Place[];
}

/** Distinct places this far apart (km) with similar names/relevance ⇒ ambiguous. */
const DISTINCT_KM = 25;
/** A rival is "comparably relevant" if its importance is ≥ this fraction of the best's. */
const RIVAL_IMPORTANCE_RATIO = 0.8;

/**
 * Geocode a query and decide whether it is ambiguous — multiple distinct places
 * a human would need to choose between — instead of silently taking result #1.
 * This is the agent-safety guard against confidently-wrong locations.
 */
export async function disambiguateLocation(
  query: string,
  options: DisambiguateOptions = {},
): Promise<Disambiguation> {
  const geocoder = options.geocoder ?? new NominatimGeocoder();
  const limit = options.limit ?? 5;
  const candidates = await geocoder.geocode(query, {
    limit,
    ...(options.language ? { language: options.language } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const best = candidates[0] ?? null;
  return { query, ambiguous: isAmbiguous(candidates), best, candidates };
}

const importanceOf = (place: Place): number => {
  const raw = place.raw as { importance?: number } | undefined;
  return typeof raw?.importance === 'number' ? raw.importance : 0;
};

const shortName = (place: Place): string =>
  (place.name || place.displayName.split(',')[0] || '').trim().toLowerCase();

function isAmbiguous(candidates: Place[]): boolean {
  if (candidates.length < 2) return false;
  const best = candidates[0]!;
  const bestImportance = importanceOf(best);
  const bestName = shortName(best);

  return candidates.slice(1).some((rival) => {
    const farApart = haversineMeters(best.location, rival.location) > DISTINCT_KM * 1000;
    if (!farApart) return false;
    // A genuine rival is either comparably relevant, or shares the same name
    // (two real "Springfield"s) — both signal a real choice for the user.
    const comparablyRelevant =
      bestImportance > 0 && importanceOf(rival) >= bestImportance * RIVAL_IMPORTANCE_RATIO;
    const sameName = bestName.length > 0 && shortName(rival) === bestName;
    return comparablyRelevant || sameName;
  });
}

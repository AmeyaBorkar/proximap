import type {
  ComparisonReport,
  Disambiguation,
  ErrandPlan,
  GapReport,
  NearbyResult,
  Place,
  ReachableResult,
  WalkabilityReport,
} from '@proximap/core';

/**
 * Flatten a nearby-search result for agents. `concise` returns a slim, high-signal
 * payload (rank/name/category/metric/coords + a one-line summary) — materially
 * smaller than the detailed shape, for token economy.
 */
export function toNearbyPayload(result: NearbyResult, options: { concise?: boolean } = {}) {
  const { origin, results, total, routing } = result;
  const head = {
    origin: {
      name: origin.name,
      displayName: origin.displayName,
      lat: origin.location.lat,
      lng: origin.location.lng,
    },
    total,
    count: results.length,
    routing: routing ?? null,
  };

  if (options.concise) {
    return {
      ...head,
      results: results.map((poi) => ({
        rank: poi.rank,
        name: poi.name ?? null,
        category: poi.category,
        ...(poi.travelSeconds !== undefined
          ? { travelSeconds: poi.travelSeconds }
          : { distanceMeters: Math.round(poi.distanceMeters) }),
        lat: poi.location.lat,
        lng: poi.location.lng,
        ...(poi.rankingReason ? { summary: poi.rankingReason } : {}),
      })),
    };
  }

  return {
    ...head,
    results: results.map((poi) => ({
      rank: poi.rank,
      name: poi.name ?? null,
      category: poi.category,
      kind: poi.kind ?? null,
      distanceMeters: Math.round(poi.distanceMeters),
      travelSeconds: poi.travelSeconds ?? null,
      travelMeters: poi.travelMeters ?? null,
      lat: poi.location.lat,
      lng: poi.location.lng,
      osmId: poi.id,
      completeness: poi.completeness ?? null,
      lastVerified: poi.lastVerified ?? null,
      wheelchair: poi.tags.wheelchair ?? null,
      wheelchairDescription: poi.tags['wheelchair:description'] ?? null,
      openState: poi.openState ?? null,
      nextChange: poi.nextChange ?? null,
      rankingReason: poi.rankingReason ?? null,
    })),
  };
}

const compactPlace = (place: Place) => ({
  name: place.name,
  displayName: place.displayName,
  lat: place.location.lat,
  lng: place.location.lng,
  kind: place.kind ?? null,
});

/** Flatten a geocoding disambiguation: best guess + ranked candidates + an ambiguity flag. */
export function toDisambiguationPayload(result: Disambiguation) {
  return {
    query: result.query,
    ambiguous: result.ambiguous,
    best: result.best ? compactPlace(result.best) : null,
    candidates: result.candidates.map(compactPlace),
  };
}

/** Flatten an errand plan for agent consumption. */
export function toErrandsPayload(plan: ErrandPlan) {
  return {
    origin: {
      name: plan.origin.name,
      displayName: plan.origin.displayName,
      lat: plan.origin.location.lat,
      lng: plan.origin.location.lng,
    },
    end: plan.end
      ? {
          displayName: plan.end.displayName,
          lat: plan.end.location.lat,
          lng: plan.end.location.lng,
        }
      : null,
    mode: plan.mode,
    totalSeconds: plan.totalSeconds,
    totalMeters: plan.totalMeters,
    missing: plan.missing,
    stops: plan.stops.map((stop) => ({
      category: stop.category,
      name: stop.poi.name ?? null,
      kind: stop.poi.kind ?? null,
      osmId: stop.poi.id,
      lat: stop.poi.location.lat,
      lng: stop.poi.location.lng,
      legSeconds: stop.legSeconds,
      legMeters: stop.legMeters,
    })),
  };
}

/** Flatten an isochrone-reachability result for agent consumption. */
export function toReachablePayload(result: ReachableResult) {
  return {
    origin: {
      name: result.origin.name,
      displayName: result.origin.displayName,
      lat: result.origin.location.lat,
      lng: result.origin.location.lng,
    },
    withinMinutes: result.withinMinutes,
    mode: result.mode,
    isochrone: result.isochrone, // [lng, lat] ring, or null
    count: result.count,
    results: result.results.map((poi) => ({
      rank: poi.rank,
      name: poi.name ?? null,
      category: poi.category,
      kind: poi.kind ?? null,
      travelSeconds: poi.travelSeconds ?? null,
      travelMeters: poi.travelMeters ?? null,
      distanceMeters: Math.round(poi.distanceMeters),
      lat: poi.location.lat,
      lng: poi.location.lng,
      osmId: poi.id,
    })),
  };
}

/** Map geocoding candidates to compact records. */
export function toGeocodePayload(places: Place[]) {
  return places.map((place) => ({
    name: place.name,
    displayName: place.displayName,
    lat: place.location.lat,
    lng: place.location.lng,
    kind: place.kind ?? null,
  }));
}

/** Flatten an amenity-gap report for agent consumption. */
export function toGapsPayload(report: GapReport) {
  return {
    origin: {
      name: report.origin.name,
      displayName: report.origin.displayName,
      lat: report.origin.location.lat,
      lng: report.origin.location.lng,
    },
    searchRadiusMeters: report.searchRadiusMeters,
    thresholdMeters: report.thresholdMeters,
    gaps: report.gaps,
    missing: report.missing,
  };
}

/** Flatten a walkability report for agent consumption. */
export function toScorePayload(report: WalkabilityReport) {
  return {
    origin: {
      name: report.origin.name,
      displayName: report.origin.displayName,
      lat: report.origin.location.lat,
      lng: report.origin.location.lng,
    },
    score: report.score,
    confidence: report.confidence,
    decay: report.decay,
    breakdown: report.breakdown,
    missing: report.missing,
  };
}

/** Flatten a location-comparison report for agent consumption. */
export function toComparePayload(report: ComparisonReport) {
  return {
    ranked: report.ranked.map((entry) => ({
      index: entry.index,
      displayName: entry.origin.displayName,
      score: entry.score,
    })),
    best: report.best
      ? {
          index: report.best.index,
          displayName: report.best.origin.displayName,
          score: report.best.score,
        }
      : null,
    weights: report.weights,
    dimensions: report.dimensions,
    locations: report.locations.map((location) => ({
      name: location.origin.name,
      displayName: location.origin.displayName,
      lat: location.origin.location.lat,
      lng: location.origin.location.lng,
      score: location.score,
      confidence: location.confidence,
      missing: location.missing,
      breakdown: location.breakdown,
    })),
  };
}

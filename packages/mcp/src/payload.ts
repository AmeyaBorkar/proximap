import type { GapReport, NearbyResult, Place, WalkabilityReport } from '@proximap/core';

/** Flatten a nearby-search result into a compact, agent-friendly object. */
export function toNearbyPayload(result: NearbyResult) {
  const { origin, results, total } = result;
  return {
    origin: {
      name: origin.name,
      displayName: origin.displayName,
      lat: origin.location.lat,
      lng: origin.location.lng,
    },
    total,
    count: results.length,
    results: results.map((poi) => ({
      rank: poi.rank,
      name: poi.name ?? null,
      category: poi.category,
      kind: poi.kind ?? null,
      distanceMeters: Math.round(poi.distanceMeters),
      lat: poi.location.lat,
      lng: poi.location.lng,
      osmId: poi.id,
      completeness: poi.completeness ?? null,
      lastVerified: poi.lastVerified ?? null,
      wheelchair: poi.tags.wheelchair ?? null,
      wheelchairDescription: poi.tags['wheelchair:description'] ?? null,
      openState: poi.openState ?? null,
      nextChange: poi.nextChange ?? null,
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

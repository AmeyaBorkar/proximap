import type { NearbyResult, Place } from '@proximap/core';

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

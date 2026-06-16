import type { NearbyResult } from './nearby';
import type { RankedPoi } from './types';

/**
 * ODbL attribution for exported OpenStreetMap data. OSM's licence lets you store
 * and redistribute results (unlike the commercial APIs) **provided you keep this
 * notice** — so exporters emit it and callers should keep it with the data.
 */
export const ODBL_ATTRIBUTION =
  '© OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright)';

export interface GeoJsonFeature {
  type: 'Feature';
  /** GeoJSON uses [longitude, latitude] order (RFC 7946). */
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  /** ODbL attribution, per {@link ODBL_ATTRIBUTION}. */
  attribution: string;
  features: GeoJsonFeature[];
}

/** Serialize a nearby-search result to a GeoJSON FeatureCollection (one Point per POI). */
export function toGeoJSON(result: NearbyResult): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    attribution: ODBL_ATTRIBUTION,
    features: result.results.map(poiToFeature),
  };
}

function poiToFeature(poi: RankedPoi): GeoJsonFeature {
  const properties: Record<string, unknown> = {
    rank: poi.rank,
    name: poi.name ?? null,
    category: poi.category,
    kind: poi.kind ?? null,
    distanceMeters: Math.round(poi.distanceMeters),
    osmId: poi.id,
  };
  if (poi.completeness !== undefined) properties.completeness = poi.completeness;
  if (poi.lastVerified) properties.lastVerified = poi.lastVerified;
  if (poi.openState) properties.openState = poi.openState;
  if (poi.nextChange) properties.nextChange = poi.nextChange;
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [poi.location.lng, poi.location.lat] },
    properties,
  };
}

const CSV_COLUMNS = [
  'rank',
  'name',
  'category',
  'kind',
  'distance_m',
  'lat',
  'lng',
  'osm_id',
  'completeness',
  'last_verified',
  'open_state',
] as const;

/** Serialize a nearby-search result to RFC 4180 CSV (header row + one row per POI). */
export function toCSV(result: NearbyResult): string {
  const rows = [CSV_COLUMNS.join(',')];
  for (const poi of result.results) {
    rows.push(
      [
        poi.rank,
        csvField(poi.name ?? ''),
        poi.category,
        csvField(poi.kind ?? ''),
        Math.round(poi.distanceMeters),
        poi.location.lat,
        poi.location.lng,
        poi.id,
        poi.completeness ?? '',
        poi.lastVerified ?? '',
        poi.openState ?? '',
      ].join(','),
    );
  }
  return rows.join('\n');
}

/** Quote a CSV field when it contains a comma, quote, or newline (doubling quotes). */
function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Domain model for proximap. These types are provider-agnostic: OpenStreetMap
 * is the default backend, but anything implementing {@link GeocodingProvider}
 * and {@link PlacesProvider} can drive the same pipeline.
 */

/** A WGS84 latitude/longitude coordinate, in decimal degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Normalized, top-level categories every POI is bucketed into. This is the
 * single source of truth — {@link Category} is derived from it.
 */
export const CATEGORIES = [
  'food',
  'grocery',
  'shopping',
  'healthcare',
  'education',
  'finance',
  'transport',
  'fuel',
  'parking',
  'accommodation',
  'leisure',
  'tourism',
  'worship',
  'public_service',
  'utility',
  'other',
] as const;

/** A normalized amenity/utility category. */
export type Category = (typeof CATEGORIES)[number];

/**
 * A single OSM tag selector, e.g. `{ key: 'amenity', value: 'cafe' }` or
 * `{ key: 'cuisine', value: 'coffee_shop', regex: true }`. An omitted `value`
 * matches the mere presence of the key.
 */
export interface CategorySelector {
  key: string;
  value?: string;
  /** Treat `value` as an Overpass regular expression (the `~` operator). */
  regex?: boolean;
}

/** A geocoded location — the resolved origin of a search. */
export interface Place {
  /** Best-effort short name, e.g. "Eiffel Tower". */
  name: string;
  /** Full human-readable label from the geocoder. */
  displayName: string;
  location: LatLng;
  /** Geocoder-provided class/type, e.g. "tourism" or "city". */
  kind?: string;
  /** Bounding box as [south, north, west, east], if provided. */
  boundingBox?: [number, number, number, number];
  /** Identifier of the provider that produced this result, e.g. "nominatim". */
  source: string;
  /** Raw provider payload, for advanced consumers. */
  raw?: unknown;
}

/** A point of interest: an amenity, utility, shop, or similar feature. */
export interface Poi {
  /** Stable identifier, e.g. "node/123" or "way/456". */
  id: string;
  name?: string;
  category: Category;
  /** The specific source value behind the category, e.g. "restaurant". */
  kind?: string;
  location: LatLng;
  /** Original source tags/attributes (e.g. OSM tags). */
  tags: Record<string, string>;
  source: string;
  /** Share of expected tags present for this category, in [0, 1]. */
  completeness?: number;
  /** Best-effort last-verified date (YYYY-MM-DD) from check_date/survey/meta. */
  lastVerified?: string;
}

/** Whether a place is open at a given time: known states or "not enough data". */
export type OpenState = 'open' | 'closed' | 'unknown';

/** A {@link Poi} enriched with distance from the search origin and a rank. */
export interface RankedPoi extends Poi {
  /** Great-circle distance from the origin, in metres. */
  distanceMeters: number;
  /** Composite score in [0, 1]; higher is better. */
  score: number;
  /** 1-based position after ranking. */
  rank: number;
  /** Open/closed/unknown at the queried time — set only when `open` was requested. */
  openState?: OpenState;
  /** ISO 8601 timestamp of the next open/closed transition, when computable. */
  nextChange?: string;
  /** Travel duration from the origin in seconds — set only when ranking by travel time. */
  travelSeconds?: number;
  /** Travel distance from the origin in metres — set only when ranking by travel time. */
  travelMeters?: number;
}

/** Options for a geocoding lookup. */
export interface GeocodeOptions {
  /** Maximum number of candidates to return. */
  limit?: number;
  /** Preferred result language, e.g. "en". */
  language?: string;
  signal?: AbortSignal;
}

/** Resolves place names/addresses to coordinates (and optionally back). */
export interface GeocodingProvider {
  readonly name: string;
  geocode(query: string, options?: GeocodeOptions): Promise<Place[]>;
  reverse?(location: LatLng, options?: GeocodeOptions): Promise<Place | null>;
}

/** Options for a nearby-places search. */
export interface NearbyOptions {
  /** Search radius from the center, in metres. */
  radiusMeters: number;
  /** Restrict results to these normalized categories (post-classification). */
  categories?: Category[];
  /**
   * Tag selectors that drive a targeted query (and define what to keep). When
   * set, the provider should fetch only matching features instead of the broad
   * default set. Takes precedence over `categories` for query construction.
   */
  selectors?: CategorySelector[];
  /** Upper bound on POIs fetched from the provider. */
  limit?: number;
  signal?: AbortSignal;
}

/** Finds points of interest around a coordinate. */
export interface PlacesProvider {
  readonly name: string;
  findNearby(center: LatLng, options: NearbyOptions): Promise<Poi[]>;
}

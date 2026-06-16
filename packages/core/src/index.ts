/**
 * @proximap/core — geospatial engine for places, proximity, and amenities.
 *
 * Defaults to OpenStreetMap (Nominatim + Overpass) with no API keys, but every
 * stage is pluggable via the provider interfaces in {@link ./types}.
 */

/** Library version, kept in sync with package.json. */
export const VERSION = '0.1.0';

export * from './types';
export * from './geo';
export * from './categories';
export * from './http';
export * from './providers';

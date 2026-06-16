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
export * from './taxonomy';
export * from './quality';
export * from './hours';
export * from './http';
export * from './providers';
export * from './ranking';
export * from './routing';
export * from './filters';
export * from './origin';
export * from './disambiguate';
export * from './proximity';
export * from './nearby';
export * from './reachable';
export * from './gaps';
export * from './walkability';
export * from './compare';
export * from './errands';
export * from './export';

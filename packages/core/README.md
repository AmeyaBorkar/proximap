# @proximap/core

Geospatial engine for [proximap](https://github.com/AmeyaBorkar/proximap):
geocoding, nearby search, travel-time ranking, walkability, gap detection,
reachability, location comparison, and errand planning. OpenStreetMap by default
(no API keys), with pluggable geocoding / places / routing providers. Zero runtime
dependencies.

## Install

```bash
npm install @proximap/core
```

## Usage

```ts
import { findNearbyAmenities } from '@proximap/core';

const { origin, results } = await findNearbyAmenities('Brandenburg Gate, Berlin', {
  radiusMeters: 800,
  categories: ['food', 'transport'],
  limit: 15,
});

console.log(origin.displayName);
for (const r of results) {
  console.log(`#${r.rank} ${r.name ?? r.category} — ${r.distanceMeters} m`);
}
```

### Bring your own provider

```ts
import { findNearbyAmenities, type PlacesProvider } from '@proximap/core';

const myProvider: PlacesProvider = {
  name: 'my-source',
  async findNearby(center, options) {
    /* return Poi[] */
  },
};

await findNearbyAmenities('Tokyo Station', { places: myProvider });
```

`findNearbyAmenities` also takes `filters` (diet/payment/wifi/wheelchair…),
`accessible` (step-free-first ranking), `open` (`'now'` or `{ at }`, keeping
unknown-hours places labelled rather than dropped), `rankBy: 'travelTime'` with a
`routing` engine, and `explain` (a short `rankingReason` per result).

### Beyond "what's nearby"

```ts
import {
  detectGaps,
  walkabilityScore,
  reachableAmenities,
  compareLocations,
  planErrands,
  disambiguateLocation,
} from '@proximap/core';

// What everyday amenities are missing? (absence framed as "not found in OSM")
const gaps = await detectGaps('Brandenburg Gate, Berlin', { thresholdMeters: 1000 });

// How walkable is it? 0-100 with a transparent, tunable breakdown + confidence.
const walk = await walkabilityScore('Brandenburg Gate, Berlin');

// What's within a 15-minute walk? (real isochrone where available)
const reach = await reachableAmenities('Brandenburg Gate, Berlin', { within: 15, mode: 'walk' });

// Compare neighbourhoods; plan the shortest one-per-category errand trip.
const cmp = await compareLocations(['Prenzlauer Berg, Berlin', 'Marzahn, Berlin']);
const trip = await planErrands('Alexanderplatz, Berlin', { categories: ['pharmacy', 'atm', 'grocery'] });

// Don't guess a wrong location — surface candidates when a name is ambiguous.
const geo = await disambiguateLocation('Springfield'); // → { ambiguous, best, candidates }
```

### Offline & export

```ts
import { snapshotArea, DatasetPlacesProvider, toGeoJSON } from '@proximap/core';

const dataset = await snapshotArea('Montmartre, Paris', { radiusMeters: 1500 });
const offline = new DatasetPlacesProvider(dataset); // findNearby with no network
const fc = toGeoJSON(await findNearbyAmenities('48.8867,2.3431', { places: offline }));
```

### Bring your own provider

```ts
import { findNearbyAmenities, type PlacesProvider, type RoutingProvider } from '@proximap/core';
// Implement PlacesProvider / GeocodingProvider / RoutingProvider and pass via
// findNearbyAmenities(query, { places, geocoder, routing }).
```

Also exported: providers (`NominatimGeocoder`, `OverpassPlacesProvider`,
`ValhallaRoutingProvider`, `OsrmRoutingProvider`, `HaversineRoutingProvider`),
`rankByProximity`, `nearestMatchingPoi`, `isOpenAt`, `toGeoJSON`/`toCSV`,
`pointInPolygon`, `categorize`, `haversineMeters`, `formatDistance`,
`formatDuration`, `CATEGORIES`, and the domain types. See the
[main README](https://github.com/AmeyaBorkar/proximap#readme).

## License

MIT

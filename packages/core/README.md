# @proximap/core

Geospatial engine for [proximap](https://github.com/AmeyaBorkar/proximap):
geocoding, nearby-places search, and distance ranking. OpenStreetMap by default
(no API keys), with pluggable providers. Zero runtime dependencies.

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

### Beyond "what's nearby"

```ts
import { detectGaps, walkabilityScore } from '@proximap/core';

// What everyday amenities are missing? (absence framed as "not found in OSM")
const report = await detectGaps('Brandenburg Gate, Berlin', { thresholdMeters: 1000 });
console.log(report.missing); // e.g. ['grocery']

// How walkable is it? 0-100 with a transparent, tunable breakdown.
const walk = await walkabilityScore('Brandenburg Gate, Berlin');
console.log(walk.score, walk.confidence, walk.breakdown);
```

`findNearbyAmenities` also takes `filters` (diet/payment/wifi/wheelchair…),
`accessible` (step-free-first ranking), and `open` (`'now'` or `{ at }`) to keep
only places open at a time — unknown hours are kept and labelled, not dropped.

Also exported: `NominatimGeocoder`, `OverpassPlacesProvider`, `rankByProximity`,
`nearestMatchingPoi`, `isOpenAt`, `categorize`, `haversineMeters`,
`formatDistance`, `CATEGORIES`, and the domain types. See the
[main README](https://github.com/AmeyaBorkar/proximap#readme).

## License

MIT

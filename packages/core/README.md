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

Also exported: `NominatimGeocoder`, `OverpassPlacesProvider`, `rankByProximity`,
`categorize`, `haversineMeters`, `formatDistance`, `CATEGORIES`, and the domain
types. See the [main README](https://github.com/AmeyaBorkar/proximap#readme).

## License

MIT

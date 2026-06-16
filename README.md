# proximap

> A geospatial toolkit for **places, proximity, and amenities** — built on OpenStreetMap, no API keys required.

`proximap` answers questions like _"what's near here, and in what order?"_ Give it a place name or
coordinates and it finds the surrounding amenities and utilities, then ranks them by distance (and,
increasingly, by travel time and other signals).

It ships as a **library**, a **CLI**, and an **MCP server** (so AI agents like Claude can call it as a
tool). The same engine is designed to be ported to Python for PyPI, and a Web UI is planned.

> **Status:** early / v0. The core API is stabilising; expect changes before 1.0.

## Why

- **Zero config.** Defaults to [OpenStreetMap](https://www.openstreetmap.org) — [Nominatim](https://nominatim.org/)
  for geocoding and the [Overpass API](https://overpass-api.de/) for points of interest. No keys, no billing.
- **Pluggable providers.** Bring your own Google Maps / Mapbox / Foursquare key for richer data by
  implementing a small interface — the rest of the pipeline is unchanged.
- **Dependency-free core.** Uses the platform `fetch`; geospatial math is built in.
- **One engine, many surfaces.** Library, CLI, and MCP server share the same core.

## Packages

| Package | What it is | Install |
| --- | --- | --- |
| [`@proximap/core`](packages/core) | The geospatial engine (geocoding, nearby search, ranking) | `npm i @proximap/core` |
| [`@proximap/cli`](packages/cli) | The `proximap` command-line tool | `npm i -g @proximap/cli` |
| [`@proximap/mcp`](packages/mcp) | MCP server exposing proximap as agent tools | `npm i @proximap/mcp` |

Planned: `apps/web` (Web UI) and `python/` (PyPI port).

## Quick start

### CLI

```bash
# Find what's within 1 km of a place, ranked by distance
proximap near "Eiffel Tower, Paris" --radius 1000 --limit 20

# Only certain categories, as JSON
proximap near "MG Road, Bengaluru" --category healthcare --category food --json
```

### Library

```ts
import { findNearbyAmenities } from '@proximap/core';

const { origin, results } = await findNearbyAmenities('Brandenburg Gate, Berlin', {
  radiusMeters: 800,
  categories: ['food', 'transport'],
  limit: 15,
});

console.log(`Around ${origin.displayName}:`);
for (const r of results) {
  console.log(`#${r.rank} ${r.name ?? r.category} — ${r.distanceMeters} m`);
}
```

## How it works

```
place / coords ──▶ GeocodingProvider ──▶ origin (lat,lng)
                                            │
                                            ▼
                     PlacesProvider (Overpass) ──▶ nearby POIs
                                            │
                                            ▼
                     ranking (haversine distance + score) ──▶ ranked results
```

## Development

```bash
npm install        # install workspace deps
npm run build      # build core, then cli + mcp
npm run typecheck  # tsc --noEmit across packages
npm test           # vitest
npm run check      # build + typecheck + format:check + test
```

This is an npm-workspaces monorepo (Node 20+). See [ROADMAP.md](ROADMAP.md) for what's next and
[ARCHITECTURE.md](ARCHITECTURE.md) for the design.

## Data & attribution

Map data from OpenStreetMap contributors, available under the
[Open Database License](https://www.openstreetmap.org/copyright). Please respect the
[Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) and
[Overpass usage policy](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) — for
production or high-volume use, run your own instances or use a commercial provider.

## License

[MIT](LICENSE) © Ameya Borkar

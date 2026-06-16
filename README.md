# proximap

> A geospatial toolkit for **places, proximity, and amenities** — built on OpenStreetMap, no API keys required.

`proximap` started with _"what's near here, and in what order?"_ and grew into a small toolkit for
reasoning about access to places: rank nearby amenities by distance **or travel time**, score how
**walkable** somewhere is, find what's **missing**, see what's **reachable** in 15 minutes, plan the
shortest **multi-stop errand**, and **compare** candidate neighbourhoods — all key-free on open data.

It ships as a **library**, a **CLI**, and an **MCP server** (so AI agents like Claude can call it as a
tool). The same engine is designed to be ported to Python for PyPI, and a Web UI is planned.

> **Status:** v0, pre-1.0. The feature surface below is implemented and tested against live OSM; the
> API is stabilising and may change before 1.0.

## Why

- **Zero config.** Defaults to [OpenStreetMap](https://www.openstreetmap.org) — [Nominatim](https://nominatim.org/)
  for geocoding and the [Overpass API](https://overpass-api.de/) for points of interest, plus the
  key-free [Valhalla](https://valhalla1.openstreetmap.de) FOSSGIS instance for routing. No keys, no billing.
- **Composition over raw data.** proximap's edge is openness + composition + agent-native delivery:
  it turns commodity primitives (routing, isochrones) into ranked, amenity-aware answers, and builds
  the things that are genuinely underserved on open data (NL categories, open-now, accessibility,
  walkability, gap detection, errand planning).
- **Honest about data.** OSM under-maps some places, so absence is framed as "not found in OSM," every
  score carries a **confidence**, and ambiguous place names return **candidates** instead of a wrong guess.
- **Dependency-free core.** Uses the platform `fetch`; geospatial math and the `opening_hours` evaluator
  are built in. Pluggable providers let you bring your own geocoder/places/routing backend.
- **One engine, many surfaces.** Library, CLI, and MCP server share the same core.

## What it can do

| Capability | CLI | Library | MCP tool |
| --- | --- | --- | --- |
| Nearby amenities, ranked by distance | `near` | `findNearbyAmenities` | `find_nearby_amenities` |
| …ranked by **travel time** (walk/bike/drive) | `near --by travel-time` | `findNearbyAmenities({ rankBy })` | `find_nearby_amenities` |
| **Facet filters** (diet, payment, wifi…) & **accessibility-first** | `near --filter … --accessible` | `findNearbyAmenities({ filters, accessible })` | `find_nearby_amenities` |
| **Open now / open at** a time | `near --open-now` | `findNearbyAmenities({ open })` · `isOpenAt` | `find_nearby_amenities` |
| Geocode with **disambiguation** | `geocode` | `disambiguateLocation` | `geocode` |
| **Gap detection** — what's missing | `gaps` | `detectGaps` | `detect_amenity_gaps` |
| **Walkability score** (0–100 + breakdown) | `score` | `walkabilityScore` | `walkability_score` |
| **Compare** N locations | `compare` | `compareLocations` | `compare_locations` |
| **Reachability** within N minutes (isochrone) | `reachable` | `reachableAmenities` | `reachable_amenities` |
| **Errand planner** (shortest one-per-category trip) | `errands` | `planErrands` | `plan_errands` |
| **Export** GeoJSON / CSV | `near --format …` | `toGeoJSON` · `toCSV` | — |
| **Snapshot** an area & query it **offline** | `snapshot` · `near --dataset` | `snapshotArea` · `DatasetPlacesProvider` | — |
| **Bulk** scoring → CSV | `bulk` | `walkabilityScore` (loop) | — |
| List the category vocabulary | — | `categoryVocabulary` | `list_categories` |

## Packages

| Package | What it is | Install |
| --- | --- | --- |
| [`@proximap/core`](packages/core) | The geospatial engine | `npm i @proximap/core` |
| [`@proximap/cli`](packages/cli) | The `proximap` command-line tool | `npm i -g @proximap/cli` |
| [`@proximap/mcp`](packages/mcp) | MCP server exposing proximap as agent tools | `npm i @proximap/mcp` |

Planned: `apps/web` (Web UI) and `python/` (PyPI port).

## Quick start

### CLI

```bash
# What's within 1 km, ranked by distance
proximap near "Eiffel Tower, Paris" --radius 1000 --limit 20

# Rank by real walking time; only vegan takeaway places that take contactless
proximap near "Kreuzberg, Berlin" -c food --by travel-time --filter diet=vegan --filter takeaway

# Open right now, accessibility-first
proximap near "Alexanderplatz, Berlin" -c cafe --open-now --accessible

# How walkable is this address? What's missing? What's within a 15-min walk?
proximap score    "Brandenburg Gate, Berlin"
proximap gaps     "Brandenburg Gate, Berlin" --threshold 1000
proximap reachable "Brandenburg Gate, Berlin" --within 15min -c grocery

# Shortest trip that hits one of each; compare two neighbourhoods
proximap errands "Alexanderplatz, Berlin" -c pharmacy -c atm -c grocery
proximap compare "Prenzlauer Berg, Berlin" "Marzahn, Berlin" --weights grocery=3,transport=2

# Capture an area, then query it offline; export for GIS
proximap snapshot "Montmartre, Paris" --out montmartre.json
proximap near "48.8867,2.3431" -c cafe --dataset montmartre.json
proximap near "Eiffel Tower, Paris" -c food --format geojson > food.geojson
```

See [`packages/cli`](packages/cli) for the full command reference.

### Library

```ts
import { findNearbyAmenities, walkabilityScore, detectGaps } from '@proximap/core';

const { origin, results } = await findNearbyAmenities('Brandenburg Gate, Berlin', {
  radiusMeters: 800,
  categories: ['food', 'transport'],
  open: 'now',
  explain: true,
});
for (const r of results) console.log(`#${r.rank} ${r.name} — ${r.rankingReason}`);

const walk = await walkabilityScore('Brandenburg Gate, Berlin'); // → { score, confidence, breakdown, missing }
const gaps = await detectGaps('Brandenburg Gate, Berlin', { thresholdMeters: 1000 });
```

## How it works

```
query: place name | "lat,lng" | LatLng
   │
   ├─ GeocodingProvider (Nominatim)  ─▶ origin   (disambiguateLocation flags ambiguity)
   │
   ├─ PlacesProvider (Overpass / offline Dataset)  ─▶ Poi[]
   │     ├─ categorize(tags) → one of 16 categories     ├─ dedupe + completeness / lastVerified
   │     └─ targeted query from the NL category resolver
   │
   ├─ filters (facets / accessibility / open-now) ─▶ kept POIs
   │
   └─ ranking
        ├─ by distance (haversine)                         ─▶ RankedPoi[]
        └─ by travel time (RoutingProvider: Valhalla / OSRM / haversine fallback)

composed features: walkabilityScore · detectGaps · reachableAmenities · compareLocations · planErrands
```

`findNearbyAmenities()` in `packages/core/src/nearby.ts` is the headline entry point;
[ARCHITECTURE.md](ARCHITECTURE.md) covers the design.

## Development

```bash
npm install        # install workspace deps
npm run build      # build core, then cli + mcp
npm run typecheck  # tsc --noEmit across packages
npm test           # vitest
npm run check      # build + typecheck + format:check + test (the per-commit gate)
```

This is an npm-workspaces monorepo (Node 20+). See [ROADMAP.md](ROADMAP.md) for what's next,
[ARCHITECTURE.md](ARCHITECTURE.md) for the design, and [`docs/proposals/`](docs/proposals/README.md)
for the per-feature specs.

## Data & attribution

Map data from OpenStreetMap contributors, available under the
[Open Database License](https://www.openstreetmap.org/copyright) — which (unlike commercial APIs) lets
you **store and export** results; `--format` and `snapshot` output carry the ODbL notice. Please respect
the [Nominatim](https://operations.osmfoundation.org/policies/nominatim/),
[Overpass](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html), and Valhalla/FOSSGIS usage
policies — for production or high-volume use, run your own instances.

## License

[MIT](LICENSE) © Ameya Borkar

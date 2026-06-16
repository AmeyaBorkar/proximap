# Architecture

proximap is an **npm-workspaces monorepo**. A single engine (`@proximap/core`)
powers multiple surfaces: a CLI, an MCP server, and — planned — a Web UI and a
Python port.

## Layout

```
packages/core   geospatial engine (published library, dual ESM/CJS)
packages/cli    `proximap` command-line tool
packages/mcp    Model Context Protocol server (tools for AI agents)
apps/web        Web UI (planned)
python/         PyPI port (planned)
```

## Data flow

```
query: place name | "lat,lng" | LatLng
   │
   ├─ GeocodingProvider.geocode()  (or parseCoordinates for "lat,lng")  ─▶ origin: Place
   │
   ├─ PlacesProvider.findNearby(origin, { radiusMeters, categories })   ─▶ Poi[]
   │        └─ categorize(tags): OSM tags ─▶ one of 16 normalized categories
   │
   └─ rankByProximity(origin, pois)  ─▶ RankedPoi[]  (haversine distance + score + rank)
```

`findNearbyAmenities()` in `packages/core/src/nearby.ts` wires these together
and is the headline entry point.

## Key decisions

- **OpenStreetMap by default.** Nominatim (geocoding) + Overpass (POIs) need no
  API key. OSM's amenity tagging is well-suited to "what's nearby."
- **Provider abstraction.** `GeocodingProvider` and `PlacesProvider` are small
  interfaces. Google Maps / Mapbox / Foursquare can be dropped in with a user's
  key without touching the ranking pipeline.
- **Dependency-free core.** HTTP uses the platform `fetch`; distances use a
  hand-written haversine. Smaller install, fewer supply-chain risks.
- **TypeScript-first.** The near-term surfaces (MCP, Web UI) are JS-native and
  npm publishing is native. The core is deliberately portable so a Python
  implementation can mirror it for PyPI.
- **Build:** `tsup` emits dual ESM/CJS + d.ts for the library; the CLI and MCP
  server are ESM executables with a shebang banner.
- **TS 6 note:** `ignoreDeprecations: "6.0"` is set in `tsconfig.base.json`
  because tsup's d.ts step injects a `baseUrl`, which TypeScript 6 treats as a
  deprecation error.
- **Ranking:** nearest-first by default. Supplying `categoryWeights` or a custom
  `scoreFn` switches to highest-score-first (ties broken by distance).

## Extending

- **New data source:** implement `GeocodingProvider` / `PlacesProvider` and pass
  it via `findNearbyAmenities(query, { geocoder, places })`.
- **New category:** extend `CATEGORIES` in `types.ts` and the mapping in
  `categories.ts` (the label map is exhaustive, so the compiler will remind you).
- **New surface:** add a package/app that depends on `@proximap/core`.

## Quality gates

`npm run check` = `build` + `typecheck` + `format:check` + `test`. CI runs it on
Node 20 and 24. Every commit is kept green and bisectable.

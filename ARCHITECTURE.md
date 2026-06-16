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
   ├─ resolveOrigin → GeocodingProvider.geocode()  (parseCoordinates for "lat,lng")  ─▶ origin: Place
   │                  └─ disambiguateLocation(): ambiguous names ─▶ ranked candidates, not a guess
   │
   ├─ PlacesProvider.findNearby(origin, { radiusMeters, selectors })  ─▶ Poi[]
   │        ├─ taxonomy: NL term ("coffee") ─▶ targeted Overpass tag union
   │        ├─ categorize(tags): OSM tags ─▶ one of 16 normalized categories
   │        └─ dedupePois + completeness / lastVerified quality signals
   │
   ├─ filters: facets (diet/payment/wifi/wheelchair) · open-now (isOpenAt) · accessibility
   │
   └─ ranking
        ├─ rankByProximity (haversine, stable id tie-break)               ─▶ RankedPoi[]
        └─ rankByTravelTime (RoutingProvider.matrix → Valhalla/OSRM,        + travelSeconds
                             haversine fallback)                            + rankingReason
```

`findNearbyAmenities()` in `packages/core/src/nearby.ts` wires these together and is the headline
entry point. Higher-level features **compose** it (and the same providers): `walkabilityScore`,
`detectGaps`, `reachableAmenities`, `compareLocations`, and `planErrands`.

## Core modules

```
types · geo (haversine, formatters) · categories · taxonomy (NL resolver)
quality (dedup + completeness) · hours (opening_hours evaluator) · http (rate limit/retry/cache)
proximity (nearestMatchingPoi) · ranking · routing (RoutingProvider + haversine + geometry)
filters (facets + accessibility scorer) · origin · disambiguate · nearby
reachable · gaps · walkability · compare · errands (Generalized-TSP DP) · export · snapshot

providers/  nominatim · overpass · valhalla · osrm
```

Each composed feature exposes a CLI command and (where it suits an agent) an MCP tool, over the same
core function.

## Key decisions

- **OpenStreetMap by default.** Nominatim (geocoding) + Overpass (POIs) need no
  API key. OSM's amenity tagging is well-suited to "what's nearby."
- **Provider abstraction.** `GeocodingProvider`, `PlacesProvider`, and
  `RoutingProvider` are small interfaces. Google Maps / Mapbox / Foursquare /
  self-hosted routing can be dropped in with a user's key/endpoint without
  touching the pipeline. A file-backed `DatasetPlacesProvider` answers queries
  offline from a `snapshot`.
- **Routing is composed, not built.** Travel time and isochrones come from
  pluggable engines (Valhalla via the key-free FOSSGIS instance, or OSRM), and
  **degrade gracefully to haversine** so everything works key-free and offline.
- **Dependency-free core.** HTTP uses the platform `fetch`; distances use a
  hand-written haversine; the `opening_hours` evaluator is hand-written for the
  common grammar (and returns `unknown`, never a guess, for the rest). Smaller
  install, fewer supply-chain risks.
- **Honest about data.** OSM under-maps some areas, so absence is framed as
  "not found in OSM," scores carry a `confidence`, and ambiguous place names
  return candidates rather than a confident wrong pick.
- **Agent-native.** Deterministic ordering (stable `id` tie-break), optional
  `explain` reasons, a concise MCP payload mode, and disambiguation make the
  MCP surface safe and economical for agents.
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
- **New routing engine:** implement `RoutingProvider` (`matrix`, optional
  `isochrone`) and pass it via `{ routing }` to `findNearbyAmenities`,
  `reachableAmenities`, or `planErrands`.
- **New category / term:** extend `CATEGORIES` in `types.ts`, the mapping in
  `categories.ts` (the label map is exhaustive, so the compiler reminds you), and
  the query vocabulary in `taxonomy.ts`.
- **New surface:** add a package/app that depends on `@proximap/core`.

## Quality gates

`npm run check` = `build` + `typecheck` + `format:check` + `test`. CI runs it on
Node 20 and 24. Every commit is kept green and bisectable.

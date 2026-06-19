# Changelog

All notable changes to proximap are documented here. The project follows
[Semantic Versioning](https://semver.org): the published packages
(`@proximap/core`, `@proximap/cli`, `@proximap/mcp`) share one version.

## 1.0.1 — 2026-06-18

Patch release: correctness fixes from a multi-agent audit sweep (each verified
with a regression test). No API changes.

### Fixed

- **reachable:** `reachableAmenities` clamps each result's `score` to `[0, 1]` —
  a road-network isochrone can enclose a POI whose matrix travel time exceeds
  the budget, which previously produced a negative score.
- **hours:** holiday-only `opening_hours` (e.g. `PH off`, `SH closed`) now
  evaluate to `unknown` instead of `closed` — there is no regular schedule to
  justify a state.
- **ranking / filters:** both proximity scorers guard against `radiusMeters: 0`
  (a POI at the origin previously yielded a `NaN` score that corrupted the sort).
- **filters:** accessibility tier bands are now strictly separated, so a
  step-free POI at the search-radius edge always outranks a `limited` one at the
  origin (they previously tied at the boundary).
- **geo:** `formatDistance` rounds into kilometres at the 1 km boundary
  (`999.5 m` → `"1.0 km"`, not `"1000 m"`).
- **cli:** the geocode ambiguity banner no longer overstates the number of
  "distinct places" (it labels the count as candidates).

## 1.0.0 — 2026-06-16

First stable release. Everything below is implemented and verified against live
OpenStreetMap. The public API is now stable per SemVer.

### Core capabilities

- **Nearby search**, ranked by straight-line **distance** or road-network
  **travel time** (`findNearbyAmenities`).
- **Natural-language categories** — "coffee", "chemist", "petrol" resolve to the
  right OSM tag unions; unknown terms suggest corrections.
- **POI dedup + quality signals** — collapse node/way duplicates; per-POI
  `completeness` and `lastVerified`.
- **Resilient OSM client** — client-side rate limiting, retry/backoff, optional
  caching, and Overpass error-in-`remark` detection.
- **Open-now / open-at** — a dependency-free `opening_hours` evaluator
  (`isOpenAt`); unknown hours are labelled, never a guess.
- **Facet filters + accessibility** — diet/cuisine/payment/wifi/takeaway and a
  step-free-first ranking.
- **Travel-time ranking & isochrone reachability** — pluggable `RoutingProvider`
  (key-free Valhalla, OSRM) with a haversine fallback (`reachableAmenities`).
- **Walkability score** — a transparent, tunable 0–100 score with a per-category
  breakdown and a data-confidence note (`walkabilityScore`).
- **Gap detection** — what everyday amenities are missing, framed as "not found
  in OSM" (`detectGaps`).
- **Location comparison** — rank N candidate locations by weighted access
  (`compareLocations`).
- **Errand planner** — the shortest trip that visits one of each category,
  solved exactly as a Generalized TSP (`planErrands`).
- **Agent-native** — geocoding **disambiguation** (`disambiguateLocation`),
  explainable ranking, deterministic ordering, and a concise MCP mode.
- **Export & offline** — GeoJSON/CSV export, area **snapshots**, an offline
  `DatasetPlacesProvider`, and bulk scoring — all carrying the ODbL notice.

### Surfaces

- **CLI** (`@proximap/cli`): `near`, `geocode`, `gaps`, `score`, `compare`,
  `reachable`, `errands`, `snapshot`, `bulk`.
- **MCP server** (`@proximap/mcp`): `find_nearby_amenities`, `geocode`,
  `list_categories`, `detect_amenity_gaps`, `walkability_score`,
  `compare_locations`, `reachable_amenities`, `plan_errands`.
- **Library** (`@proximap/core`): zero runtime dependencies, dual ESM/CJS build,
  pluggable geocoding / places / routing providers.

### Known follow-ups (non-breaking; tracked in the roadmap)

Polygon centroids for ways/relations, `opening_hours` timezone/holiday
correctness, MCP `outputSchema`/elicitation, Parquet export and bulk over
`near`/`gaps`, and facet push-down to Overpass.

# Roadmap

proximap starts with "what's near here, ranked?" and grows into a broader
geospatial toolkit. Ordering is indicative, not a commitment.

## Shipped

The full researched backlog (proposals 01–12) is **implemented (v1)** and verified against live OSM.

- [x] Place / address / `lat,lng` → nearby amenities, ranked by **distance or travel time**
- [x] OSM backends, no API keys: Nominatim (geocoding), Overpass (POIs), Valhalla/OSRM (routing)
- [x] 16-category taxonomy + natural-language category resolver
- [x] Pluggable `GeocodingProvider` / `PlacesProvider` / `RoutingProvider`; offline `DatasetPlacesProvider`
- [x] CLI (9 commands): `near`, `geocode`, `gaps`, `score`, `compare`, `reachable`, `errands`, `snapshot`, `bulk`
- [x] MCP server (8 tools): `find_nearby_amenities`, `geocode`, `list_categories`, `detect_amenity_gaps`,
      `walkability_score`, `compare_locations`, `reachable_amenities`, `plan_errands`
- [x] Facets/accessibility, open-now, export (GeoJSON/CSV), disambiguation, explainable + deterministic output
- [x] Dependency-free core, dual ESM/CJS build, CI on Node 20 & 24

The features came out of a competitive-research pass (2026-06). The guiding finding: proximap's edge is
**openness + composition + agent-native delivery**, not richer data — so we built what's underserved on
open data and merely *consume* commodities like routing/isochrones. Full designs (and v1 limitations) live
in [`docs/proposals/`](docs/proposals/README.md).

### P0 — foundation (unlocks the rest) — ✅ shipped

- [x] [Natural-language category resolver](docs/proposals/01-nl-category-resolver.md)
      — "coffee" → the right OSM tag union (no JS/Python lib does this)
- [x] [POI dedup, centroids & quality signals](docs/proposals/02-poi-dedup-and-quality.md)
      — collapse node/way duplicates; add completeness + freshness
- [x] [Resilient, cached, policy-safe OSM client](docs/proposals/03-resilient-osm-client.md)
      — rate limits, retries, caching, self-host/offline

### P1 — ✅ shipped

- [x] [Open-now / open-at](docs/proposals/04-open-now.md) — query by `opening_hours`
      (`--open-now`, `--open-at`; dependency-free evaluator)
- [x] [Facet filters + accessibility-first search](docs/proposals/05-facets-and-accessibility.md)
      — diet/payment/wifi + wheelchair/step-free ranking (`--filter`, `--accessible`)
- [x] [Travel-time ranking & isochrone reachability](docs/proposals/06-travel-time-and-isochrones.md)
      — pluggable OSRM/Valhalla, haversine fallback (`near --by travel-time`, `reachable`)
- [x] [Transparent walkability / 15-minute score](docs/proposals/07-walkability-score.md)
      — **signature/novel**: open, tunable alternative to Walk Score (`score` / `walkability_score`)
- [x] [Amenity gap / "desert" detection](docs/proposals/08-amenity-gap-detection.md)
      — **signature/novel**: report what's _missing_ (`gaps` / `detect_amenity_gaps`)
- [x] [Agent-native outputs & disambiguation](docs/proposals/11-agent-native-outputs.md)
      — disambiguation, `explain`, concise mode, stable ordering (`outputSchema` pending)

### P2 — ✅ shipped

- [x] [Multi-stop errand planner](docs/proposals/09-errand-planner.md)
      — **most novel**: one POI per category, shortest trip (Generalized TSP) (`errands`)
- [x] [Location comparison / relocation scorecard](docs/proposals/10-location-comparison.md)
      — rank N addresses by weighted access (`compare` / `compare_locations`)
- [x] [Export, bulk scoring & offline datasets](docs/proposals/12-export-bulk-offline.md)
      — leverages OSM's freely-storable data (commercial APIs forbid this):
      `near --format geojson|csv`, `snapshot`, `near --dataset` (offline), `bulk`. Parquet pending.

### v1 follow-ups (within shipped features)

- [ ] Polygon centroids for ways/relations ([02](docs/proposals/02-poi-dedup-and-quality.md))
- [ ] `opening_hours` timezone/holiday correctness ([04](docs/proposals/04-open-now.md))
- [ ] MCP `outputSchema` / `structuredContent` + elicitation ([11](docs/proposals/11-agent-native-outputs.md))
- [ ] Bulk over `near`/`gaps` + Parquet export ([12](docs/proposals/12-export-bulk-offline.md))
- [ ] Facet push-down to Overpass; curb-cut/tactile-paving pass ([05](docs/proposals/05-facets-and-accessibility.md))

### Platform

- [ ] More providers (bring-your-own-key): Google Places, Mapbox, Foursquare
- [ ] **Python port → PyPI** (`pip install proximap`); name reserved
- [ ] **Web UI** (`apps/web`): map + search over `@proximap/core`
- [ ] **Claude Code plugin** packaging around the MCP server

### Deliberately deprioritized

- **Cross-provider POI conflation** — Overture Maps + Placekey already publish
  deduped POIs with confidence/stable IDs; the key-free constraint would make us
  re-derive a worse subset. (We may instead _enrich_ from the open
  Overture/Foursquare dumps.)
- **Demographic trade-area analysis** — the valuable layer (population, foot
  traffic) isn't in OSM, and competitor-density catchment is already free via
  OpenRouteService isochrone stats.

Have an idea? See [CONTRIBUTING.md](CONTRIBUTING.md).

# Roadmap

proximap starts with "what's near here, ranked?" and grows into a broader
geospatial toolkit. Ordering is indicative, not a commitment.

## Shipped — v0

- [x] Place / address / `lat,lng` → nearby amenities, ranked by distance
- [x] OpenStreetMap backends (Nominatim geocoding + Overpass POIs), no API keys
- [x] 16-category taxonomy with filtering
- [x] Pluggable `GeocodingProvider` / `PlacesProvider` interfaces
- [x] CLI: `near`, `geocode`
- [x] MCP server: `find_nearby_amenities`, `geocode`
- [x] Dependency-free core, dual ESM/CJS build, CI on Node 20 & 24

The next features come out of a competitive-research pass (2026-06). The guiding
finding: proximap's edge is **openness + composition + agent-native delivery**,
not richer data — so we build what's underserved on open data and merely *consume*
commodities like routing/isochrones. Full designs live in
[`docs/proposals/`](docs/proposals/README.md).

### P0 — foundation (unlocks the rest) — ✅ shipped

- [x] [Natural-language category resolver](docs/proposals/01-nl-category-resolver.md)
      — "coffee" → the right OSM tag union (no JS/Python lib does this)
- [x] [POI dedup, centroids & quality signals](docs/proposals/02-poi-dedup-and-quality.md)
      — collapse node/way duplicates; add completeness + freshness
- [x] [Resilient, cached, policy-safe OSM client](docs/proposals/03-resilient-osm-client.md)
      — rate limits, retries, caching, self-host/offline

### P1 — next milestone

- [x] [Open-now / open-at](docs/proposals/04-open-now.md) — query by `opening_hours`
      (`--open-now`, `--open-at`; dependency-free evaluator)
- [x] [Facet filters + accessibility-first search](docs/proposals/05-facets-and-accessibility.md)
      — diet/payment/wifi + wheelchair/step-free ranking (`--filter`, `--accessible`)
- [ ] [Travel-time ranking & isochrone reachability](docs/proposals/06-travel-time-and-isochrones.md)
      — pluggable OSRM/Valhalla/ORS, haversine fallback _(commodity, composed)_
- [x] [Transparent walkability / 15-minute score](docs/proposals/07-walkability-score.md)
      — **signature/novel**: open, tunable alternative to Walk Score (`score` / `walkability_score`)
- [x] [Amenity gap / "desert" detection](docs/proposals/08-amenity-gap-detection.md)
      — **signature/novel**: report what's _missing_ (`gaps` / `detect_amenity_gaps`)
- [ ] [Agent-native outputs & disambiguation](docs/proposals/11-agent-native-outputs.md)
      — schema-stable output, concise mode, ambiguity as candidates

### P2 — following

- [ ] [Multi-stop errand planner](docs/proposals/09-errand-planner.md)
      — **most novel**: one POI per category, shortest trip (Generalized TSP)
- [x] [Location comparison / relocation scorecard](docs/proposals/10-location-comparison.md)
      — rank N addresses by weighted access (`compare` / `compare_locations`)
- [~] [Export, bulk scoring & offline datasets](docs/proposals/12-export-bulk-offline.md)
      — leverages OSM's freely-storable data (commercial APIs forbid this).
      v1: `near --format geojson|csv` with an ODbL notice. Bulk/snapshot/offline pending.

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

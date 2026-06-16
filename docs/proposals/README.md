# Feature proposals

Designed, **not yet implemented** — a researched backlog for proximap. Each
proposal is a focused spec (problem → surface → data/algorithm → risks →
acceptance). Implementation is tracked separately as tasks.

## Guiding insight (from competitive research)

proximap's defensible edge is **openness + composition + agent-native delivery**,
**not** richer place data. Google/Foursquare/HERE beat raw OSM on POI density,
ratings, and live popularity, and OSM has no review signal. So:

- **Build** the things that are genuinely underserved on open, key-free data:
  natural-language categories, open-now, accessibility, a transparent
  walkability score, "what's missing" gap detection, and category-based errand
  planning.
- **Consume, don't advertise** the commodities: routing, distance matrices, and
  isochrones are solved (OSRM/Valhalla/ORS self-host them; Mapbox/TravelTime
  sell them). We wrap them behind a provider and fall back to haversine.
- **Deprioritize** what others already deliver better: cross-provider POI
  conflation (Overture Maps + Placekey already publish deduped POIs with
  confidence) and demographic trade-area analysis (the valuable layer —
  population/foot-traffic — isn't in OSM). See notes in `09`/below.

## Index

| # | Proposal | Tier | Novelty | Complexity |
|---|----------|------|---------|------------|
| [01](01-nl-category-resolver.md) | Natural-language category resolver | P0 foundation | Differentiated | Med |
| [02](02-poi-dedup-and-quality.md) | POI dedup, centroids & quality signals | P0 foundation | Differentiated | Med |
| [03](03-resilient-osm-client.md) | Resilient, cached, policy-safe OSM client | P0 foundation | Low–Med |
| [04](04-open-now.md) | Open-now / open-at filtering & ranking | P1 | Differentiated | Med–High |
| [05](05-facets-and-accessibility.md) | Facet filters + accessibility-first search | P1 | Differentiated | Low–Med |
| [06](06-travel-time-and-isochrones.md) | Travel-time ranking & isochrone reachability | P1 | Table-stakes (composed) | Med |
| [07](07-walkability-score.md) | Transparent walkability / 15-minute score | P1 signature | Novel | Med–High |
| [08](08-amenity-gap-detection.md) | Amenity gap / "desert" detection | P1 signature | Novel | Low–Med |
| [09](09-errand-planner.md) | Multi-stop errand planner (one-per-category) | P2 signature | Novel | Med |
| [10](10-location-comparison.md) | Location comparison / relocation scorecard | P2 | Differentiated | Med |
| [11](11-agent-native-outputs.md) | Agent-native outputs & disambiguation | P1 | Differentiated | Low–Med |
| [12](12-export-bulk-offline.md) | Export, bulk scoring & offline datasets | P2 | Differentiated | Med |

Tiers: **P0** unlocks the rest; **P1** is the next milestone; **P2** follows.

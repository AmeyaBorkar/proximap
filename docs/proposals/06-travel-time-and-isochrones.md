# 06 — Travel-time ranking & isochrone reachability

- **Status:** Proposed · **Tier:** P1 · **Novelty:** Table-stakes (our value is composition) · **Complexity:** Med

## Problem

Today proximap ranks by straight-line haversine distance. Users actually care
about **minutes** — "nearest by walking time," "what's within a 15-min walk."
Routing, distance matrices, and isochrones are **commodities** (OSRM/Valhalla/ORS
self-host them; Mapbox/TravelTime sell them), so the goal is not to build an
engine — it's to **compose** these primitives with our amenity layer, key-free by
default, and fall back to haversine when no engine is configured.

## What it does

- **Travel-time ranking**: rank N nearby amenities by walk/bike/drive **duration**
  (one origin → many, a distance-matrix call).
- **Isochrone reachability**: "what amenities are within a 15-min walk?" — fetch
  the isochrone polygon, then return the **filtered amenity list** (the answer),
  not just a polygon.

## Surface

- A `RoutingProvider` interface: `matrix(origin, targets, mode)`, `isochrone(origin, minutes, mode)`.
- `findNearbyAmenities(query, { rankBy: 'travelTime', mode: 'walk' })`;
  `reachableAmenities(query, { within: '15min', mode: 'walk' })`.
- CLI: `--by walking-time`; `proximap reachable "..." --within 15min --mode walk`.
- MCP: travel-time ranking + reachability as agent tools.

## Dependencies

Pluggable backends: default **OSRM/Valhalla public or self-hosted** (key-free,
Valhalla via FOSSGIS, OSRM Table service); optional ORS/Mapbox/TravelTime via key.
Graceful fallback to haversine.

## Differentiation

The polygon/matrix themselves are **not** novel. The value is the **composition
layer**: an open, key-free, agent-native client that turns commodity routing into
ranked, amenity-aware answers and degrades to haversine. That glue is what's
missing today (ORS/Valhalla clients are bare; aggregators lock you to one stack).

## Risks & caveats

Public routing instances are ~1 req/s and non-production — document self-hosting
for scale. Matrix size limits (ORS ≤3,500 routes) require batching.

## Acceptance criteria

- `RoutingProvider` with an OSRM and a Valhalla adapter; haversine fallback.
- Travel-time ranking reorders results vs distance in a fixture test.
- `reachable` returns amenities inside the isochrone (point-in-polygon).

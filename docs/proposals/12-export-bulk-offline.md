# 12 — Export, bulk scoring & offline datasets

- **Status:** Partially implemented (v1: GeoJSON/CSV export with ODbL notice. Bulk/batch, snapshots, offline dataset provider, and Parquet are follow-ups) · **Tier:** P2 · **Novelty:** Differentiated · **Complexity:** Med

## Problem

proximap's single biggest *legal/operational* advantage is that OSM data (ODbL)
can be **freely stored, exported, and bulk-processed** — exactly what the
commercial APIs forbid: Google bans storing anything but `place_id`; Mapbox/TomTom/
Yelp restrict results to "temporary use"; Nominatim's *public* instance bans bulk/
grid queries. We should make that advantage tangible.

## What it does

- **Export** any result set to **GeoJSON / CSV / Parquet** (for GIS, notebooks,
  spreadsheets, databases).
- **Bulk / batch** scoring: run `near` / `walkabilityScore` / `gaps` over many
  input coordinates (CSV) in one command — for real-estate, site selection, logistics.
- **Offline datasets**: snapshot an area's POIs to a local file and query it
  without any network (pairs with the self-host path in [03](03-resilient-osm-client.md)).

## Surface

- CLI: `proximap near "..." --format geojson > out.geojson`;
  `proximap score --points addresses.csv --format csv`;
  `proximap snapshot "<area>" --out berlin.poi.json` then `--dataset berlin.poi.json`.
- Core: `toGeoJSON(result)`, `toCSV(result)`; a file-backed `PlacesProvider`.

## Data & algorithm

GeoJSON/CSV serializers over our result types; Parquet via an optional dependency.
Bulk mode iterates inputs with the rate-limited client ([03](03-resilient-osm-client.md)),
**strongly** recommending a self-hosted endpoint for volume. Snapshots store the
normalized POIs for a bbox/area for offline reuse.

## Differentiation

No commercial vendor permits this; the open Foursquare OS Places / Overture dumps
are static data with no query+rank layer — proximap supplies that layer and can
optionally ingest them to enrich coverage.

## Risks & caveats

Respect ODbL **attribution** on exports (emit a notice). Don't hammer public OSM
in bulk mode — gate it behind a self-host recommendation and the rate limiter.
Keep Parquet an optional dependency so core stays lean.

## Acceptance criteria

- `--format geojson|csv` emits valid, round-trippable output (tested).
- Bulk mode processes a CSV of coordinates with rate limiting and an ODbL notice.
- A snapshot file can back an offline `near` query with no network calls.

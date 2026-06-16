# 02 — POI dedup, centroids & quality signals

- **Status:** Proposed · **Tier:** P0 (foundation) · **Novelty:** Differentiated · **Complexity:** Med

## Problem

Overpass routinely returns the **same real POI twice** — once as a node and once
as a building way/relation (an explicit "one feature, one element" violation) —
so naive counts come out ~2×. `out center` returns a bounding-box center, not a
true centroid. And every OSM result carries provenance (edit time, `check_date`,
tag completeness) that no consumer app surfaces, which we can turn into trust.

## What it does

1. **Deduplicate** co-located node/way/relation representations of one POI into a
   single canonical result (distance + fuzzy-name + category agreement).
2. **Better centroids** for ways/relations (polygon centroid, not bbox center).
3. **Quality signals** per POI: a `completeness` score (share of expected tags
   present for its category), `lastVerified` (from `check_date`/`survey:date`/edit
   timestamp), and a freshness flag.

## Surface

- `Poi` gains optional `completeness: number`, `lastVerified?: string`,
  `confidence: number`. New `dedupePois(pois)` utility.
- Ranking can incorporate `completeness` (already supported via the scorer).
- CLI: a `· verified 2025` / `· sparse data` annotation; `--min-confidence`.
- MCP: each result carries `completeness`/`lastVerified` so agents can judge trust.

## Data & algorithm

Fetch with `out center tags meta;` (meta → timestamps). Blocking by geohash/H3
cell → within-cell pairwise match on distance (≤~30 m) + normalized-name
similarity (Jaro-Winkler/token-set) + compatible category → merge, preferring the
richer-tagged element. Completeness = present/expected tag keys per category.

## Differentiation

Existing libs return raw, duplicated elements; **none** dedup or expose
provenance. This is unique to OSM and a concrete trust layer. It also underpins
honest gap detection ([08](08-amenity-gap-detection.md)).

## Risks & caveats

Conservative thresholds to avoid merging genuinely distinct neighbours; make
dedup toggleable. Sparse tagging means treat missing tags as "unknown," never "no."

## Acceptance criteria

- Node+way duplicates of one POI collapse to one result in tests.
- Way/relation results report a polygon centroid.
- `completeness`/`lastVerified` populated; ranking can weight by completeness.

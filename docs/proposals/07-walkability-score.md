# 07 — Transparent walkability / 15-minute score

- **Status:** Proposed · **Tier:** P1 (signature) · **Novelty:** Novel · **Complexity:** Med–High

## Problem

People want a single answer to "how walkable / well-served is this address?" The
incumbent, **Walk Score**, is proprietary, patented, an opaque 0–100 number,
US/CA/AU-only, and its API is now effectively contact-sales/consumer-only. The
open research tools that compute this (Pandana, cityseer) are AGPL,
notebook-centric, and heavy. There is **no easy, permissively-licensed, global,
OSM-native, tunable** walkability score — this is proximap's strongest novelty.

## What it does

`walkabilityScore(location)` → a 0–100 score **plus a full breakdown**:

- Per daily-need category (groceries, dining, schools, health, parks, transit,
  pharmacy, …): nearest distance/time and a distance-decay sub-score.
- The **missing** categories called out explicitly (ties into
  [08](08-amenity-gap-detection.md)).
- A coverage-confidence note (sparse OSM data ⇒ lower confidence, not a fake 0).

## Surface

- Core: `walkabilityScore(location, { categories?, mode?, weights?, decay? })`
  → `{ score, confidence, breakdown: [{ category, nearestMeters, subScore }], missing }`.
- CLI: `proximap score "<address>"` (and `--mode walk|bike`, `--weights …`).
- MCP: `walkability_score` tool returning the structured breakdown.

## Data & algorithm

Resolve daily-need categories ([01](01-nl-category-resolver.md)) → for each,
nearest POI by distance (haversine v1) or travel time ([06](06-travel-time-and-isochrones.md)
v2) → documented distance-decay (full credit ≤~5-min walk, zero past ~30 min, à la
the published Walk Score methodology, but **open and tunable**) → weighted sum.

## Differentiation

Fills the confirmed gap between proprietary Walk Score and AGPL research libs: an
**open, transparent (breakdown not black box), tunable, global, OSM-native**
score, available as library + CLI + MCP. No equivalent exists.

## Risks & caveats

Don't present a score as authoritative where OSM coverage is thin — always return
`confidence`. Methodology must be documented and versioned. Transit *frequency*
(GTFS) isn't in OSM — score transit by *proximity* and say so.

## Acceptance criteria

- Deterministic score + breakdown for a fixture location; weights/decay tunable.
- `missing` lists daily-need categories with no POI in range.
- `confidence` reflects data density.

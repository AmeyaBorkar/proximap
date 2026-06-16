# 08 — Amenity gap / "desert" detection

- **Status:** Proposed · **Tier:** P1 (signature) · **Novelty:** Novel · **Complexity:** Low–Med

## Problem

Every tool answers "what's **present** nearby." Almost none answer "what's
**missing**" — "no pharmacy within 2 km," "nearest hospital is 8 km," "this is a
grocery desert." The computation is routine in GIS/research, but no
developer-facing library returns absence as a first-class result (Walk Score
returns a score; the USDA Food Access Atlas is static, US-only, census-tract;
GoodRx's pharmacy-desert work is a report with no API).

## What it does

Given a location and a set of expected categories, report for each: nearest
instance (distance/time) and whether it fails a **desert threshold**, plus an
overall "what's missing here" summary.

## Surface

- Core: `detectGaps(location, { categories, thresholds?, mode? })` →
  `[{ category, nearestMeters | null, isGap, confidence }]`.
- CLI: `proximap gaps "<address>"` (e.g. "✗ pharmacy — none within 2 km").
- MCP: `detect_amenity_gaps` tool.

## Data & algorithm

For each category: expanding-radius Overpass `around:` search (or KDTree over a
prefetched set) for nearest-X; compare to configurable thresholds (defaults
informed by USDA >1 mi urban / >10 mi rural, GoodRx >15 min to the 3rd pharmacy).

## Differentiation

The "report the absent" framing is essentially unoccupied as a live, key-free
API/CLI. Pairs naturally with the walkability breakdown ([07](07-walkability-score.md)).

## Risks & caveats

**The critical risk:** OSM under-maps suburban/rural/Global-South amenities, so
"absent" can mean "unmapped." This feature **must** ship with a coverage-confidence
signal ([02](02-poi-dedup-and-quality.md)) and clear wording ("no pharmacy found in
OSM within 2 km" — not "there is no pharmacy"). Never assert absence as ground truth.

## Acceptance criteria

- Returns nearest-or-null per category against fixtures.
- Threshold logic configurable; defaults documented.
- Output and docs frame gaps as "not found in OSM," with confidence attached.

# 10 — Location comparison / relocation scorecard

- **Status:** Proposed · **Tier:** P2 · **Novelty:** Differentiated · **Complexity:** Med

## Problem

"I'm deciding between these 2–3 places to live (or to open a shop) — which has
better access to what I care about?" Most tools score **one** place (Walk Score,
AreaVibes) or are enterprise/paid (Esri Business Analyst, Local Logic). The one
consumer multi-address tool (mylocationscore.com) caps at 3, is US-centric, closed,
and has no API. There's an opening for **key-free, arbitrary-N, OSM-native**
comparison as a library/CLI/MCP.

## What it does

Compare N candidate locations across weighted dimensions (amenity access by
category, greenspace, transit proximity, walkability) → a ranked scorecard with
per-dimension detail and an overall winner per the user's weights.

## Surface

- Core: `compareLocations([locA, locB, …], { dimensions?, weights? })` →
  `{ ranked: [{ location, score, breakdown }], best }`.
- CLI: `proximap compare "Addr A" "Addr B" "Addr C" --weights food=2,transit=3`.
- MCP: `compare_locations` tool.

## Data & algorithm

Reuse the walkability breakdown ([07](07-walkability-score.md)) per location →
normalize each dimension across the candidates → apply user weights → rank. Pure
composition over existing scoring.

## Differentiation

Key-free, arbitrary-N, global, OSM-native address comparison with an open
methodology and an API — not offered by the incumbents.

## Risks & caveats

Be explicit about what OSM **cannot** judge — transit *frequency* (no GTFS in
OSM), school quality, crime, prices. Label these out of scope rather than faking
them. Carry through walkability's confidence signal.

## Acceptance criteria

- Deterministic ranking for fixture locations; user weights change the order.
- Per-dimension breakdown per location; out-of-scope dimensions clearly omitted.

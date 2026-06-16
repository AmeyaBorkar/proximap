# 09 — Multi-stop errand planner (one-per-category)

- **Status:** Proposed · **Tier:** P2 (signature) · **Novelty:** Novel · **Complexity:** Med

## Problem

"I need a pharmacy **and** an ATM **and** groceries — what's the shortest trip
that hits one of each, near me?" No consumer app or mainstream routing API does
this. Google/Apple/Waze require **named** stops and only reorder them; Mapbox
Optimization, VROOM, Routific optimize the order of **fixed** stops. Nobody ships
the "pick one POI per category, then optimize" workflow — even though the math is
the well-studied **Generalized (Set) TSP**.

## What it does

Given an origin (and optional destination) and a list of categories, choose one
POI per category and order the stops to minimize total travel, returning the route
and the chosen places.

## Surface

- Core: `planErrands(origin, { categories: ['pharmacy','atm','groceries'],
  mode?, end? })` → `{ stops: RankedPoi[], order, totalMeters | totalSeconds }`.
- CLI: `proximap errands "<origin>" -c pharmacy -c atm -c groceries`.
- MCP: `plan_errands` tool (a natural agent request).

## Data & algorithm

Resolve categories ([01](01-nl-category-resolver.md)) → fetch top candidates per
category near the origin → build a duration/distance matrix
([06](06-travel-time-and-isochrones.md); haversine for the MVP) → solve the
Generalized TSP. At consumer scale (3–6 categories, a handful of candidates each)
**brute-force over combinations + a tiny TSP is exact and instant**; OR-Tools
(`AddDisjunction(..., max_cardinality=1)`) or GLKH are optional for larger inputs.

## Differentiation

Genuinely novel as a packaged feature — the primitives (Set-TSP solvers, routing)
exist, but nobody assembles the end-to-end errand workflow over categorized POIs.

## Risks & caveats

Combinatorial blow-up if candidate sets are large — cap candidates per category
(e.g. nearest K) and document it. Real travel times need a routing engine; ship an
honest haversine MVP first.

## Acceptance criteria

- Exact optimum for small inputs (verified against brute force) on fixtures.
- Respects optional fixed `end`; falls back to haversine with no routing engine.
- Caps candidates per category and logs when it does.

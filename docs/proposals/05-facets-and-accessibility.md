# 05 — Facet filters + accessibility-first search

- **Status:** Implemented (v1; JS post-filter + accessibility ranking. Overpass push-down and the curb-cut/tactile-paving footway pass are follow-ups) · **Tier:** P1 · **Novelty:** Differentiated · **Complexity:** Low–Med

## Problem

OSM carries structured consumer and accessibility tags that consumer apps rarely
expose as **combinable** filters: dietary (`diet:vegan`/`vegetarian`/`halal`/…),
`cuisine`, `payment:*`, `internet_access`, `outdoor_seating`, `takeaway`,
`delivery`, and accessibility (`wheelchair`, `toilets:wheelchair`,
`ramp:wheelchair`, plus footway `kerb`/`tactile_paving`). Accessibility-first
search in particular is badly underserved — apps usually show a single
"accessible entrance" flag, never ranking or path context.

## What it does

- **Facet filters**: compose constraints — vegan + takeaway + contactless + wifi.
- **Accessibility mode**: filter/rank by step-free access and accessible toilets,
  surface `wheelchair:description` verbatim, and optionally factor nearby curb
  cuts / tactile paving from the surrounding footway network.

## Surface

- Core: `findNearbyAmenities(query, { filters: { diet: 'vegan', wheelchair: 'yes',
  payment: 'contactless', internetAccess: true } })`.
- CLI: `--filter diet=vegan --filter wheelchair=yes --accessible`.
- MCP: a `filters` object; `accessible: true` shortcut.

## Data & algorithm

Compile facets to Overpass tag filters
(`nwr["diet:vegan"~"yes|only"]["takeaway"="yes"](around:…)`). Accessibility
ranking: primary POI query on `wheelchair`, plus an optional second `around:`
pass for `kerb`/`tactile_paving` nodes to score path context.

## Differentiation

HappyCow does diet; few tools combine diet + payment + connectivity in one ranked
query, and accessibility *ranking* (not just a flag) over open data is rare.

## Risks & caveats

Tag sparsity: missing ⇒ "unknown," not "fails the filter" (offer a strict mode
that excludes unknowns when the user insists). Footway accessibility data is patchy.

## Acceptance criteria

- Facet filters translate to correct Overpass selectors (unit-tested on fixtures).
- `--accessible` ranks step-free/accessible-toilet POIs above others and shows
  `wheelchair:description` when present.

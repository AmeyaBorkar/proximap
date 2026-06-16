# 04 — Open-now / open-at filtering & ranking

- **Status:** Implemented (v1; dependency-free evaluator for the common grammar subset — unsupported constructs and timezone-shifting are documented follow-ups) · **Tier:** P1 · **Novelty:** Differentiated · **Complexity:** Med–High

## Problem

"Find an open coffee shop near me **now**" is a top intent, and OSM stores hours
in the rich, machine-readable `opening_hours` grammar (day/time ranges, `24/7`,
`PH`/`SH` holidays, `sunrise–sunset`, midnight-wrap). But it's a formal
mini-language, not a field — "a full regex is impossible" — so almost no tool
exposes it as a query primitive, and none on open data offer **open-at-a-future-time**.

## What it does

- Filter/rank by **open now**, or **open at** a given time ("open Sunday 21:00",
  "still open in 30 min").
- Each result reports `openState` (`open`/`closed`/`unknown`) and `nextChange`.

## Surface

- Core: `findNearbyAmenities(query, { open: 'now' | { at: ISODate } })`; expose
  `isOpenAt(openingHours, when, location)`.
- CLI: `proximap near "coffee" --open-now`, `--open-at "2026-06-20T21:00"`.
- MCP: `find_nearby_amenities` gains `open` so agents can ask directly.

## Data & algorithm

Parse `opening_hours` with the proven `opening_hours.js` (≈99.3% coverage,
`getState()`/`getNextChange()`). Resolve relative to the **POI's own** timezone
and lat/lng for `sunrise`/`sunset`; use a holiday table where available. POIs
lacking the tag are `unknown` — surfaced, never silently dropped.

## Dependencies

`opening_hours.js` (optional peer in core, or isolated in a subpath so the
zero-dep core stays lean). Timezone lookup from coordinates.

## Differentiation

Google/Apple show "Open now" but rarely "open at a future time" as a query, and
**never** on open OSM data; no OSS geo lib bundles `opening_hours` evaluation.

## Risks & caveats

Hours coverage is uneven; `check_date:opening_hours` ([02](02-poi-dedup-and-quality.md))
helps flag stale hours. Timezone/holiday correctness is the hard part — lean on
the reference parser, don't reimplement.

## Acceptance criteria

- `isOpenAt` matches `opening_hours.js` on a fixture suite incl. `24/7`, breaks,
  overnight, and `PH`.
- `--open-now` filters correctly; unknown-hours POIs are labelled, not dropped.

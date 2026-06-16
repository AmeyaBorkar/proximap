# 11 — Agent-native outputs & disambiguation

- **Status:** Proposed · **Tier:** P1 · **Novelty:** Differentiated · **Complexity:** Low–Med

## Problem

proximap is one of the few geo tools shipping an MCP server, so it should be
*excellent* for agents. Today it returns reasonable JSON, but agents specifically
need: schema-stable structured output, token economy, deterministic ordering,
graceful ambiguity handling, and a rationale they can quote. Geocoding silently
takes result #1 (there are ~90 US "Springfields"; Nominatim's confidence "has
nothing to do with correctness"), which makes agents confidently wrong.

## What it does

- **Schema-stable structured output**: MCP tools declare an `outputSchema` and
  return validated `structuredContent` (per the MCP spec), not prose blobs.
- **Concise vs detailed modes**: a `response_format` enum; default to a compact,
  high-signal payload + a one-line natural-language `summary` per result.
- **Disambiguation**: when a place name is ambiguous, return `ambiguous: true` +
  ranked candidates (wired to MCP **elicitation**) instead of guessing.
- **Explainable ranking**: each result carries a short `ranking_reason`
  ("closest open cafe, 240 m"); ordering is deterministic (stable-id tie-break).

## Surface

- MCP: `outputSchema` on every tool; `response_format: 'concise' | 'detailed'`;
  ambiguous results return candidates; a `disambiguate`/elicitation path.
- Core/CLI: `findNearbyAmenities` already deterministic; add optional
  `explain: true` to attach `ranking_reason`, and surface geocoding ambiguity.

## Data & algorithm

Deterministic sort with stable tie-break (already mostly true). Ambiguity =
multiple geocoder candidates with close importance → return them. Token economy =
field whitelist + rounded numbers + summary string.

## Differentiation

None of Walk Score, TravelTime, Mapbox, or the OSM Python libs ship an MCP/agent
interface — this space is unoccupied, and these are exactly the patterns
Anthropic's tool-writing guidance calls for (deterministic, concise, meaningful
fields, human-in-the-loop for ambiguity).

## Risks & caveats

Keep `structuredContent` and the human-readable text in sync. Don't over-truncate
in concise mode — keep name/category/distance/why.

## Acceptance criteria

- Tools validate against a declared `outputSchema`; concise mode is materially
  smaller than detailed.
- Ambiguous place names return ranked candidates rather than a silent pick.
- Each result carries a `ranking_reason`; ordering is byte-stable across runs.

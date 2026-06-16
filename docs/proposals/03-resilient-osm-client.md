# 03 — Resilient, cached, policy-safe OSM client

- **Status:** Proposed · **Tier:** P0 (foundation) · **Novelty:** Differentiated · **Complexity:** Low–Med

## Problem

The public OSM endpoints are deliberately throttled and easy to misuse:
Nominatim enforces **max 1 req/s**, requires a real User-Agent (stock UAs get
403), and forbids bulk/autocomplete; Overpass allows ~2 parallel slots/IP, can
return **HTTP 200 with the error buried in `<remark>`**, and OOMs on big queries
with cryptic `rate_limited` strings. Today proximap does one request well but has
no throttling, caching, retry, or self-host story.

## What it does

A hardened client layer shared by the providers:

- **Client-side rate limiting** (token bucket; default ≤1 req/s for Nominatim).
- **Retry with backoff** on 429/504; detect Overpass error-in-`<remark>` and
  surface it as a real error.
- **Caching** (pluggable store; in-memory default, optional disk) keyed by
  normalized request — also enables deterministic test fixtures/snapshots.
- **Self-host / offline**: first-class `endpoint` config + docs for pointing at a
  private Nominatim/Overpass or an OSM extract; recommend self-host for bulk.

## Surface

- `new OverpassPlacesProvider({ endpoint, rateLimit, cache, retries })` etc.
- A `cache` interface (`get`/`set`) so users can plug Redis/disk/runtime cache.
- No API break: defaults keep today's behaviour.

## Differentiation

`overpass-frontend` caches but ignores policy/error-handling/testing; this is
pure glue every developer currently rewrites. Self-hosting OSM is something **no**
commercial vendor offers — it's proximap's data-sovereignty/zero-quota story.

## Risks & caveats

Caching POI data is fine under ODbL (attribution required); document it. Keep the
cache opt-in-able for always-fresh use. Don't ship a heavy disk-cache dep in core.

## Acceptance criteria

- Repeated identical queries hit cache (verified in tests via fixtures).
- Overpass `<remark>` errors throw a typed error; 429s retry with backoff.
- Nominatim calls are throttled to the configured rate; User-Agent enforced.

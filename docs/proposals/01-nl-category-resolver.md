# 01 — Natural-language category resolver

- **Status:** Implemented (v1) · **Tier:** P0 (foundation) · **Novelty:** Differentiated · **Complexity:** Med

## Problem

OSM has **no category layer**. POIs are fragmented across 5+ keys (`amenity` has
~9k distinct values, `shop` ~11k); "coffee" alone splits across `amenity=cafe`,
`cuisine=coffee_shop`, and `shop=coffee`. Every Overpass client today makes you
hand-write tag unions. Our current 16-category taxonomy is a good start but is
coarse and one-directional (tags → category), and doesn't understand the words a
human or an LLM actually uses ("coffee", "somewhere to eat", "chemist").

## What it does

A bidirectional, data-driven taxonomy:

- **Resolve** a natural-language term → a set of OSM tag selectors
  (`resolveCategory("coffee")` → `[amenity=cafe, cuisine~coffee_shop, shop=coffee]`).
- **Subcategories** under the existing 16 top-level categories (e.g. `food` →
  `restaurant`, `cafe`, `fast_food`, `bar`…), each with synonyms and regional
  variants ("chemist" → pharmacy, "petrol" → fuel).
- Drives **targeted Overpass queries** (only fetch the tags you asked for) and
  the reverse `categorize()` mapping from one shared source of truth.

## Surface

- Core: `resolveCategory(term: string): CategorySelector[]`, `suggestCategories(term)`,
  extend `findNearbyAmenities(query, { categories: ['coffee', 'pharmacy'] })` to
  accept NL terms (not just the 16 enums).
- CLI: `proximap near "..." -c coffee -c "vegan food"`.
- MCP: `find_nearby_amenities` gains free-text `categories`; add a
  `list_categories` tool so agents can discover the vocabulary.

## Data & algorithm

A curated, versioned taxonomy table (term → selectors, with synonyms). Selectors
compile to Overpass tag filters. Fuzzy-match unknown terms to the nearest known
category and report what was matched.

## Differentiation

No JS/Python library provides an NL-category abstraction — Turf/overpass-frontend
make you hand-write `[amenity=cafe]`; commercial taxonomies (Mapbox `/category`)
are fixed black boxes. Especially valuable for **agents**, which think in words,
not tags.

## Risks & caveats

Curation is ongoing and never complete; expose the mapping and let users extend
it. Always degrade gracefully — an unmatched term returns "unknown category" with
suggestions, never silent empty results.

## Acceptance criteria

- `resolveCategory` covers the top ~80 everyday terms with tests.
- Targeted queries fetch only requested tags; results still `categorize()` correctly.
- CLI/MCP accept NL category terms; unknown terms produce helpful suggestions.

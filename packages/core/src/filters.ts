import type { ScoreInput } from './ranking';

/**
 * Composable consumer/accessibility facets that OSM tags carry but most apps
 * never expose as combinable filters: dietary options, cuisine, payment
 * methods, connectivity, seating, and step-free access. Each facet compiles to
 * a predicate over a POI's tags; a POI must satisfy *all* active facets.
 *
 * Sparsity note: a missing tag is treated as "unknown", which means the POI is
 * not a positive match — never that it "fails". We don't claim a place lacks a
 * feature, only that OSM doesn't record it.
 */
export interface FacetFilters {
  /** Dietary options, e.g. "vegan", "vegetarian", "halal" (matches diet:<x>=yes|only). */
  diet?: string | string[];
  /** Cuisine tokens, e.g. "italian", "pizza" (matches the ;-separated cuisine tag). */
  cuisine?: string | string[];
  /** Accepted payments, e.g. "contactless", "cards", "visa" (matches payment:<x>). */
  payment?: string | string[];
  /** Require internet access (internet_access present and not "no"). */
  internetAccess?: boolean;
  /** Require outdoor seating. */
  outdoorSeating?: boolean;
  /** Require takeaway (takeaway=yes|only). */
  takeaway?: boolean;
  /** Require delivery. */
  delivery?: boolean;
  /** Required wheelchair value(s), e.g. "yes" or ["yes", "limited"]. */
  wheelchair?: string | string[];
  /** Raw tag constraints: `true` = present, `false` = absent, string = equals. */
  tags?: Record<string, string | boolean>;
}

/** A compiled facet check over a POI's tag set. */
export type FacetPredicate = (tags: Record<string, string>) => boolean;

const toArray = (v?: string | string[]): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

/** Values that count as "yes" for binary OSM facets where only yes/only apply. */
const YES_ONLY = new Set(['yes', 'only']);
const NEGATIVE = new Set(['no', 'false', '0', '']);

/** True when a tag is present and not an explicit negative (yes/wlan/customers/…). */
const isAffirmative = (value: string | undefined): boolean =>
  value !== undefined && !NEGATIVE.has(value.trim().toLowerCase());

const cuisineTokens = (tags: Record<string, string>): string[] =>
  (tags.cuisine ?? '')
    .toLowerCase()
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

/** Compile a {@link FacetFilters} object into a list of tag predicates (AND-ed). */
export function compileFacets(filters: FacetFilters): FacetPredicate[] {
  const preds: FacetPredicate[] = [];

  for (const diet of toArray(filters.diet)) {
    const key = `diet:${diet.toLowerCase()}`;
    preds.push((t) => YES_ONLY.has((t[key] ?? '').toLowerCase()));
  }
  for (const cuisine of toArray(filters.cuisine)) {
    const want = cuisine.toLowerCase();
    preds.push((t) => cuisineTokens(t).includes(want));
  }
  for (const payment of toArray(filters.payment)) {
    const key = `payment:${payment.toLowerCase()}`;
    preds.push((t) => isAffirmative(t[key]));
  }
  if (filters.internetAccess) preds.push((t) => isAffirmative(t.internet_access));
  if (filters.outdoorSeating) preds.push((t) => isAffirmative(t.outdoor_seating));
  if (filters.takeaway) preds.push((t) => YES_ONLY.has((t.takeaway ?? '').toLowerCase()));
  if (filters.delivery) preds.push((t) => isAffirmative(t.delivery));

  const wheelchair = toArray(filters.wheelchair).map((v) => v.toLowerCase());
  if (wheelchair.length > 0) {
    preds.push((t) => wheelchair.includes((t.wheelchair ?? '').toLowerCase()));
  }

  for (const [key, value] of Object.entries(filters.tags ?? {})) {
    if (value === true) preds.push((t) => t[key] !== undefined);
    else if (value === false) preds.push((t) => t[key] === undefined);
    else {
      const want = String(value).toLowerCase();
      preds.push((t) => (t[key] ?? '').toLowerCase() === want);
    }
  }
  return preds;
}

/** Does a tag set satisfy every compiled facet predicate? */
export function matchesFacets(
  tags: Record<string, string>,
  predicates: readonly FacetPredicate[],
): boolean {
  return predicates.every((predicate) => predicate(tags));
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * A ranking scorer for accessibility-first search: step-free (`wheelchair=yes`)
 * POIs rank above `limited`, which rank above unknown/none — with distance
 * breaking ties *within* each tier. Tiers occupy non-overlapping score bands so
 * an accessible-but-slightly-farther place still outranks a closer inaccessible
 * one, as the use case demands.
 */
export function accessibleScorer(): (input: ScoreInput) => number {
  return ({ poi, distanceMeters, radiusMeters }) => {
    const proximity = 1 - clamp01(distanceMeters / radiusMeters);
    const wheelchair = (poi.tags.wheelchair ?? '').toLowerCase();
    const tierBase = wheelchair === 'yes' ? 0.66 : wheelchair === 'limited' ? 0.33 : 0;
    return tierBase + proximity * 0.33;
  };
}

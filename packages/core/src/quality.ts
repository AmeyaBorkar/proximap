import { haversineMeters } from './geo';
import type { Category, Poi } from './types';

/**
 * Tags a well-described POI of each category tends to carry. Used to compute a
 * coarse completeness score — a trust signal that lets gap/score features treat
 * sparse OSM data honestly (low completeness, not a confident "no").
 */
const BASE_EXPECTED = ['name'];
const EXPECTED_BY_CATEGORY: Partial<Record<Category, string[]>> = {
  food: ['name', 'opening_hours', 'cuisine', 'website', 'phone', 'wheelchair'],
  grocery: ['name', 'opening_hours', 'website', 'phone'],
  shopping: ['name', 'opening_hours', 'website', 'phone'],
  healthcare: ['name', 'opening_hours', 'phone', 'website', 'wheelchair'],
  education: ['name', 'website', 'phone'],
  finance: ['name', 'opening_hours', 'operator'],
  transport: ['name', 'network', 'operator'],
  fuel: ['name', 'opening_hours', 'operator'],
  parking: ['capacity', 'fee', 'access'],
  accommodation: ['name', 'website', 'phone', 'stars'],
  leisure: ['name', 'opening_hours'],
  tourism: ['name', 'website', 'opening_hours'],
  worship: ['name', 'religion'],
  public_service: ['name', 'opening_hours', 'phone'],
  utility: ['fee', 'access'],
  other: ['name'],
};

/** Fraction of a category's expected tags that are present, in [0, 1]. */
export function completenessOf(category: Category, tags: Record<string, string>): number {
  const expected = EXPECTED_BY_CATEGORY[category] ?? BASE_EXPECTED;
  if (expected.length === 0) return 1;
  const present = expected.filter((key) => {
    const value = tags[key];
    return value !== undefined && value.trim() !== '';
  }).length;
  return Math.round((present / expected.length) * 100) / 100;
}

const DATE_TAGS = ['check_date', 'check_date:opening_hours', 'survey:date'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Best-effort "last verified" date (YYYY-MM-DD): an explicit survey/check_date
 * tag if present, else the element's last-edit timestamp.
 */
export function lastVerifiedOf(
  tags: Record<string, string>,
  timestamp?: string,
): string | undefined {
  for (const key of DATE_TAGS) {
    const value = tags[key];
    if (value && ISO_DATE.test(value)) return value.slice(0, 10);
  }
  if (timestamp && ISO_DATE.test(timestamp)) return timestamp.slice(0, 10);
  return undefined;
}

const normalizeName = (poi: Poi): string => (poi.name ?? '').trim().toLowerCase();

/** Heuristic: do two POIs describe the same real-world feature? Conservative. */
function isDuplicate(a: Poi, b: Poi): boolean {
  if (a.category !== b.category) return false;
  const distance = haversineMeters(a.location, b.location);
  if (distance > 40) return false;

  const an = normalizeName(a);
  const bn = normalizeName(b);
  if (an && bn) return an === bn; // both named: names must agree
  // at least one unnamed: only merge near-coincident features of the same kind
  return distance <= 15 && a.kind === b.kind;
}

/** Higher = a better representative to keep when collapsing duplicates. */
function richness(poi: Poi): number {
  let score = 0;
  if (poi.name) score += 100;
  score += (poi.completeness ?? 0) * 10;
  if (poi.id.startsWith('way/') || poi.id.startsWith('relation/')) score += 1;
  return score;
}

/**
 * Collapse duplicate representations of the same POI (e.g. a node and a building
 * way) into one, keeping the richer entry. Order of first appearance is kept.
 */
export function dedupePois(pois: Poi[]): Poi[] {
  const kept: Poi[] = [];
  for (const poi of pois) {
    const index = kept.findIndex((other) => isDuplicate(other, poi));
    if (index === -1) kept.push(poi);
    else if (richness(poi) > richness(kept[index]!)) kept[index] = poi;
  }
  return kept;
}

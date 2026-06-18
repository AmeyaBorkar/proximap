import { describe, expect, it } from 'vitest';
import { accessibleScorer, compileFacets, matchesFacets, type FacetFilters } from './filters';
import type { Poi } from './types';

const pass = (filters: FacetFilters, tags: Record<string, string>): boolean =>
  matchesFacets(tags, compileFacets(filters));

describe('compileFacets', () => {
  it('matches dietary options on diet:<x>=yes|only, not no/limited/missing', () => {
    expect(pass({ diet: 'vegan' }, { 'diet:vegan': 'yes' })).toBe(true);
    expect(pass({ diet: 'vegan' }, { 'diet:vegan': 'only' })).toBe(true);
    expect(pass({ diet: 'vegan' }, { 'diet:vegan': 'no' })).toBe(false);
    expect(pass({ diet: 'vegan' }, { 'diet:vegan': 'limited' })).toBe(false);
    expect(pass({ diet: 'vegan' }, {})).toBe(false); // unknown ⇒ not a positive match
  });

  it('matches cuisine tokens within the ;-separated tag', () => {
    expect(pass({ cuisine: 'pizza' }, { cuisine: 'italian;pizza' })).toBe(true);
    expect(pass({ cuisine: 'italian' }, { cuisine: 'italian;pizza' })).toBe(true);
    expect(pass({ cuisine: 'thai' }, { cuisine: 'italian;pizza' })).toBe(false);
  });

  it('matches payment and connectivity facets', () => {
    expect(pass({ payment: 'contactless' }, { 'payment:contactless': 'yes' })).toBe(true);
    expect(pass({ payment: 'contactless' }, { 'payment:contactless': 'no' })).toBe(false);
    expect(pass({ internetAccess: true }, { internet_access: 'wlan' })).toBe(true);
    expect(pass({ internetAccess: true }, { internet_access: 'no' })).toBe(false);
    expect(pass({ internetAccess: true }, {})).toBe(false);
  });

  it('matches takeaway/delivery/outdoor seating', () => {
    expect(pass({ takeaway: true }, { takeaway: 'only' })).toBe(true);
    expect(pass({ takeaway: true }, { takeaway: 'no' })).toBe(false);
    expect(pass({ delivery: true }, { delivery: 'yes' })).toBe(true);
    expect(pass({ outdoorSeating: true }, { outdoor_seating: 'yes' })).toBe(true);
  });

  it('matches wheelchair against an allowed set', () => {
    expect(pass({ wheelchair: ['yes', 'limited'] }, { wheelchair: 'limited' })).toBe(true);
    expect(pass({ wheelchair: 'yes' }, { wheelchair: 'no' })).toBe(false);
    expect(pass({ wheelchair: 'yes' }, {})).toBe(false);
  });

  it('supports raw tag presence/absence/equality constraints', () => {
    expect(pass({ tags: { brand: 'Aldi' } }, { brand: 'Aldi' })).toBe(true);
    expect(pass({ tags: { brand: 'Aldi' } }, { brand: 'Lidl' })).toBe(false);
    expect(pass({ tags: { phone: true } }, { phone: '+49' })).toBe(true);
    expect(pass({ tags: { phone: true } }, {})).toBe(false);
    expect(pass({ tags: { fee: false } }, {})).toBe(true); // absent as required
  });

  it('AND-combines multiple facets', () => {
    const filters: FacetFilters = { diet: 'vegan', takeaway: true };
    expect(pass(filters, { 'diet:vegan': 'yes', takeaway: 'yes' })).toBe(true);
    expect(pass(filters, { 'diet:vegan': 'yes' })).toBe(false); // missing takeaway
    expect(compileFacets({})).toHaveLength(0); // no facets ⇒ no constraints
  });
});

describe('accessibleScorer', () => {
  const score = accessibleScorer();
  const poi = (wheelchair?: string): Poi => ({
    id: 'node/1',
    category: 'food',
    location: { lat: 0, lng: 0 },
    tags: wheelchair ? { wheelchair } : {},
    source: 'fake',
  });

  it('ranks yes above limited above none, regardless of distance', () => {
    // A far step-free POI still beats a near inaccessible one.
    const farYes = score({ poi: poi('yes'), distanceMeters: 900, radiusMeters: 1000 });
    const nearNone = score({ poi: poi(), distanceMeters: 10, radiusMeters: 1000 });
    const nearLimited = score({ poi: poi('limited'), distanceMeters: 10, radiusMeters: 1000 });
    expect(farYes).toBeGreaterThan(nearLimited);
    expect(nearLimited).toBeGreaterThan(nearNone);
  });

  it('breaks ties within a tier by proximity', () => {
    const near = score({ poi: poi('yes'), distanceMeters: 100, radiusMeters: 1000 });
    const far = score({ poi: poi('yes'), distanceMeters: 800, radiusMeters: 1000 });
    expect(near).toBeGreaterThan(far);
  });

  it('a step-free POI at the radius edge strictly outranks limited at the origin', () => {
    // Documented guarantee: the tiers must not merely tie at the band boundary.
    const yesAtEdge = score({ poi: poi('yes'), distanceMeters: 1000, radiusMeters: 1000 });
    const limitedAtOrigin = score({ poi: poi('limited'), distanceMeters: 0, radiusMeters: 1000 });
    expect(yesAtEdge).toBeGreaterThan(limitedAtOrigin);
  });

  it('does not produce NaN when radiusMeters is 0', () => {
    expect(Number.isNaN(score({ poi: poi('yes'), distanceMeters: 0, radiusMeters: 0 }))).toBe(
      false,
    );
  });
});

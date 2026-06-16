import { describe, expect, it } from 'vitest';
import { completenessOf, dedupePois, lastVerifiedOf } from './quality';
import type { Poi } from './types';

describe('completenessOf', () => {
  it('scores by the share of expected category tags present', () => {
    // food expects 6: name, opening_hours, cuisine, website, phone, wheelchair
    expect(
      completenessOf('food', { name: 'X', cuisine: 'pizza', opening_hours: '24/7' }),
    ).toBeCloseTo(0.5, 5);
    expect(completenessOf('food', {})).toBe(0);
  });

  it('ignores empty tag values', () => {
    expect(completenessOf('food', { name: '  ' })).toBe(0);
  });
});

describe('lastVerifiedOf', () => {
  it('prefers explicit survey/check_date tags', () => {
    expect(lastVerifiedOf({ check_date: '2025-03-04' })).toBe('2025-03-04');
    expect(lastVerifiedOf({ 'survey:date': '2024-01-09' })).toBe('2024-01-09');
  });

  it('falls back to the element timestamp', () => {
    expect(lastVerifiedOf({}, '2023-11-02T08:30:00Z')).toBe('2023-11-02');
  });

  it('returns undefined when nothing usable is present', () => {
    expect(lastVerifiedOf({})).toBeUndefined();
    expect(lastVerifiedOf({ check_date: 'sometime' })).toBeUndefined();
  });
});

describe('dedupePois', () => {
  const base = (over: Partial<Poi>): Poi => ({
    id: 'node/1',
    category: 'food',
    location: { lat: 0, lng: 0 },
    tags: {},
    source: 'test',
    ...over,
  });

  it('collapses a node and a way for the same feature, keeping the richer', () => {
    const node = base({ id: 'node/1', name: 'Cafe A', completeness: 0.2 });
    const way = base({
      id: 'way/9',
      name: 'Cafe A',
      completeness: 0.6,
      location: { lat: 0.0001, lng: 0 },
    });
    const out = dedupePois([node, way]);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('way/9');
  });

  it('keeps distinctly named features', () => {
    const a = base({ id: 'node/1', name: 'Cafe A' });
    const b = base({ id: 'node/2', name: 'Cafe B', location: { lat: 0.0001, lng: 0 } });
    expect(dedupePois([a, b])).toHaveLength(2);
  });

  it('does not merge across categories', () => {
    const cafe = base({ id: 'node/1', name: 'X', category: 'food' });
    const bank = base({ id: 'node/2', name: 'X', category: 'finance' });
    expect(dedupePois([cafe, bank])).toHaveLength(2);
  });
});

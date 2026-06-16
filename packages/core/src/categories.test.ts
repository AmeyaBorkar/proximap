import { describe, expect, it } from 'vitest';
import { categorize, isCategory } from './categories';

describe('categorize', () => {
  it('maps food amenities', () => {
    expect(categorize({ amenity: 'restaurant' })).toEqual({ category: 'food', kind: 'restaurant' });
  });

  it('splits shops into grocery vs shopping', () => {
    expect(categorize({ shop: 'supermarket' }).category).toBe('grocery');
    expect(categorize({ shop: 'clothes' }).category).toBe('shopping');
  });

  it('routes lodging tourism to accommodation, sights to tourism', () => {
    expect(categorize({ tourism: 'hotel' }).category).toBe('accommodation');
    expect(categorize({ tourism: 'museum' }).category).toBe('tourism');
  });

  it('recognizes transport from several keys', () => {
    expect(categorize({ railway: 'station' }).category).toBe('transport');
    expect(categorize({ highway: 'bus_stop' }).category).toBe('transport');
    expect(categorize({ amenity: 'bus_station' }).category).toBe('transport');
  });

  it('treats civic infrastructure as utilities', () => {
    expect(categorize({ amenity: 'toilets' }).category).toBe('utility');
  });

  it('falls back to other, preserving the unknown value', () => {
    expect(categorize({}).category).toBe('other');
    expect(categorize({ amenity: 'something_unknown' })).toEqual({
      category: 'other',
      kind: 'something_unknown',
    });
  });
});

describe('isCategory', () => {
  it('validates category strings', () => {
    expect(isCategory('food')).toBe(true);
    expect(isCategory('nonsense')).toBe(false);
  });
});

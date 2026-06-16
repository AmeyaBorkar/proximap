import { describe, expect, it } from 'vitest';
import {
  categoryVocabulary,
  isKnownTerm,
  resolveCategories,
  selectorToOverpassFilter,
  suggestCategories,
  tagsMatchAnySelector,
  tagsMatchSelector,
} from './taxonomy';
import { CATEGORIES } from './types';

describe('resolveCategories', () => {
  it('resolves a natural-language term to OSM selectors', () => {
    const { selectors, matched, unknown } = resolveCategories(['coffee']);
    expect(unknown).toEqual([]);
    expect(matched[0]).toMatchObject({ input: 'coffee', term: 'coffee', category: 'food' });
    expect(selectors).toContainEqual({ key: 'amenity', value: 'cafe' });
    expect(selectors).toContainEqual({ key: 'cuisine', value: 'coffee_shop', regex: true });
  });

  it('resolves synonyms and is case/space insensitive', () => {
    expect(resolveCategories(['Chemist']).matched[0]).toMatchObject({
      term: 'pharmacy',
      category: 'healthcare',
    });
    expect(resolveCategories(['  PETROL ']).matched[0]).toMatchObject({ term: 'fuel' });
  });

  it('deduplicates selectors across terms', () => {
    const { selectors } = resolveCategories(['coffee', 'cafe']);
    const cafe = selectors.filter((s) => s.key === 'amenity' && s.value === 'cafe');
    expect(cafe).toHaveLength(1);
  });

  it('reports unknown terms', () => {
    const { unknown } = resolveCategories(['coffee', 'definitely-not-a-place']);
    expect(unknown).toEqual(['definitely-not-a-place']);
  });
});

describe('isKnownTerm / suggestCategories', () => {
  it('knows terms and synonyms', () => {
    expect(isKnownTerm('gas station')).toBe(true);
    expect(isKnownTerm('nonsense')).toBe(false);
  });

  it('suggests close matches for typos', () => {
    expect(suggestCategories('coffe')).toContain('coffee');
    expect(suggestCategories('pharamcy')).toContain('pharmacy');
  });
});

describe('categoryVocabulary', () => {
  it('covers every top-level category', () => {
    const categories = new Set(categoryVocabulary().map((entry) => entry.category));
    for (const category of CATEGORIES) expect(categories.has(category)).toBe(true);
  });
});

describe('selectorToOverpassFilter', () => {
  it('renders exact, regex, and presence filters', () => {
    expect(selectorToOverpassFilter({ key: 'amenity', value: 'cafe' })).toBe('["amenity"="cafe"]');
    expect(selectorToOverpassFilter({ key: 'cuisine', value: 'pizza', regex: true })).toBe(
      '["cuisine"~"pizza"]',
    );
    expect(selectorToOverpassFilter({ key: 'shop' })).toBe('["shop"]');
  });
});

describe('tag matching', () => {
  it('matches exact, regex, and presence', () => {
    expect(tagsMatchSelector({ amenity: 'cafe' }, { key: 'amenity', value: 'cafe' })).toBe(true);
    expect(tagsMatchSelector({ amenity: 'bar' }, { key: 'amenity', value: 'cafe' })).toBe(false);
    expect(
      tagsMatchSelector(
        { cuisine: 'coffee_shop;tea' },
        { key: 'cuisine', value: 'coffee_shop', regex: true },
      ),
    ).toBe(true);
    expect(tagsMatchSelector({ shop: 'whatever' }, { key: 'shop' })).toBe(true);
  });

  it('matches any of several selectors', () => {
    const { selectors } = resolveCategories(['coffee']);
    expect(tagsMatchAnySelector({ amenity: 'cafe' }, selectors)).toBe(true);
    expect(tagsMatchAnySelector({ amenity: 'bank' }, selectors)).toBe(false);
  });
});

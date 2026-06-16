import type { Category, CategorySelector } from './types';

/**
 * Maps the words people (and agents) actually use — "coffee", "chemist",
 * "petrol" — to the OSM tag selectors that find them, and rolls each up to one
 * of the 16 normalized {@link Category} buckets. This is the query vocabulary;
 * `categorize()` is the inverse (tags -> category) used when reading results.
 */
interface TermDefinition {
  /** Canonical term. */
  term: string;
  category: Category;
  selectors: CategorySelector[];
  /** Alternative spellings/phrasings that resolve to this term. */
  synonyms?: string[];
}

const a = (value: string): CategorySelector => ({ key: 'amenity', value });
const shop = (value: string): CategorySelector => ({ key: 'shop', value });
const leisure = (value: string): CategorySelector => ({ key: 'leisure', value });
const tourism = (value: string): CategorySelector => ({ key: 'tourism', value });
const rx = (key: string, value: string): CategorySelector => ({ key, value, regex: true });
const present = (key: string): CategorySelector => ({ key });

const TERMS: TermDefinition[] = [
  // food
  {
    term: 'food',
    category: 'food',
    selectors: [a('restaurant'), a('cafe'), a('fast_food'), a('bar'), a('pub'), a('food_court')],
    synonyms: ['food and drink', 'places to eat', 'eat', 'dining', 'somewhere to eat'],
  },
  { term: 'restaurant', category: 'food', selectors: [a('restaurant')], synonyms: ['restaurants'] },
  { term: 'cafe', category: 'food', selectors: [a('cafe')], synonyms: ['café', 'cafes'] },
  {
    term: 'coffee',
    category: 'food',
    selectors: [a('cafe'), rx('cuisine', 'coffee_shop'), shop('coffee')],
    synonyms: ['coffee shop', 'coffeehouse'],
  },
  {
    term: 'fast food',
    category: 'food',
    selectors: [a('fast_food')],
    synonyms: ['fastfood', 'takeaway food'],
  },
  { term: 'bar', category: 'food', selectors: [a('bar')], synonyms: ['bars'] },
  { term: 'pub', category: 'food', selectors: [a('pub')], synonyms: ['pubs'] },
  { term: 'pizza', category: 'food', selectors: [rx('cuisine', 'pizza')], synonyms: ['pizzeria'] },
  { term: 'ice cream', category: 'food', selectors: [a('ice_cream')], synonyms: ['gelato'] },

  // grocery
  {
    term: 'grocery',
    category: 'grocery',
    selectors: [shop('supermarket'), shop('convenience'), shop('greengrocer'), shop('grocery')],
    synonyms: ['groceries', 'grocery store', 'food shopping'],
  },
  { term: 'supermarket', category: 'grocery', selectors: [shop('supermarket')] },
  {
    term: 'convenience',
    category: 'grocery',
    selectors: [shop('convenience')],
    synonyms: ['convenience store', 'corner shop'],
  },
  { term: 'bakery', category: 'grocery', selectors: [shop('bakery')], synonyms: ['baker'] },

  // shopping
  {
    term: 'shopping',
    category: 'shopping',
    selectors: [present('shop')],
    synonyms: ['shops', 'stores', 'retail'],
  },
  {
    term: 'mall',
    category: 'shopping',
    selectors: [shop('mall'), shop('department_store')],
    synonyms: ['shopping mall', 'shopping centre', 'shopping center'],
  },
  {
    term: 'clothes',
    category: 'shopping',
    selectors: [shop('clothes')],
    synonyms: ['clothing', 'fashion'],
  },

  // healthcare
  {
    term: 'healthcare',
    category: 'healthcare',
    selectors: [
      a('hospital'),
      a('clinic'),
      a('doctors'),
      a('dentist'),
      a('pharmacy'),
      present('healthcare'),
    ],
    synonyms: ['health', 'medical', 'health care'],
  },
  {
    term: 'pharmacy',
    category: 'healthcare',
    selectors: [a('pharmacy'), rx('healthcare', 'pharmacy')],
    synonyms: ['chemist', 'drugstore', 'drug store'],
  },
  {
    term: 'hospital',
    category: 'healthcare',
    selectors: [a('hospital')],
    synonyms: ['hospitals', 'emergency room', 'a&e'],
  },
  { term: 'clinic', category: 'healthcare', selectors: [a('clinic'), rx('healthcare', 'clinic')] },
  {
    term: 'doctor',
    category: 'healthcare',
    selectors: [a('doctors'), rx('healthcare', 'doctor')],
    synonyms: ['doctors', 'gp', 'physician'],
  },
  {
    term: 'dentist',
    category: 'healthcare',
    selectors: [a('dentist'), rx('healthcare', 'dentist')],
    synonyms: ['dental'],
  },

  // education
  {
    term: 'education',
    category: 'education',
    selectors: [a('school'), a('college'), a('university'), a('kindergarten'), a('library')],
    synonyms: ['schools'],
  },
  { term: 'school', category: 'education', selectors: [a('school')] },
  {
    term: 'university',
    category: 'education',
    selectors: [a('university'), a('college')],
    synonyms: ['college', 'uni'],
  },
  { term: 'library', category: 'education', selectors: [a('library')], synonyms: ['libraries'] },

  // finance
  {
    term: 'finance',
    category: 'finance',
    selectors: [a('bank'), a('atm'), a('bureau_de_change')],
    synonyms: ['money', 'banking'],
  },
  {
    term: 'atm',
    category: 'finance',
    selectors: [a('atm')],
    synonyms: ['cash machine', 'cashpoint'],
  },
  { term: 'bank', category: 'finance', selectors: [a('bank')], synonyms: ['banks'] },

  // transport
  {
    term: 'transport',
    category: 'transport',
    selectors: [
      a('bus_station'),
      { key: 'public_transport', value: 'station' },
      rx('railway', 'station|halt|tram_stop|subway_entrance|stop'),
      { key: 'highway', value: 'bus_stop' },
      { key: 'aeroway', value: 'aerodrome' },
    ],
    synonyms: ['public transport', 'transit'],
  },
  {
    term: 'bus stop',
    category: 'transport',
    selectors: [{ key: 'highway', value: 'bus_stop' }, a('bus_station')],
    synonyms: ['bus', 'bus station'],
  },
  {
    term: 'train station',
    category: 'transport',
    selectors: [rx('railway', 'station|halt'), { key: 'public_transport', value: 'station' }],
    synonyms: ['railway station', 'train', 'metro', 'metro station', 'subway', 'subway station'],
  },
  { term: 'taxi', category: 'transport', selectors: [a('taxi')] },
  {
    term: 'airport',
    category: 'transport',
    selectors: [{ key: 'aeroway', value: 'aerodrome' }],
    synonyms: ['airports'],
  },

  // fuel
  {
    term: 'fuel',
    category: 'fuel',
    selectors: [a('fuel'), a('charging_station')],
    synonyms: ['petrol', 'gas', 'gas station', 'petrol station', 'filling station'],
  },
  {
    term: 'ev charging',
    category: 'fuel',
    selectors: [a('charging_station')],
    synonyms: ['charging station', 'ev charger', 'charger'],
  },

  // parking
  {
    term: 'parking',
    category: 'parking',
    selectors: [a('parking')],
    synonyms: ['car park', 'parking lot'],
  },
  {
    term: 'bicycle parking',
    category: 'parking',
    selectors: [a('bicycle_parking')],
    synonyms: ['bike parking'],
  },

  // accommodation
  {
    term: 'accommodation',
    category: 'accommodation',
    selectors: [tourism('hotel'), tourism('hostel'), tourism('guest_house'), tourism('motel')],
    synonyms: ['lodging', 'places to stay', 'stay'],
  },
  { term: 'hotel', category: 'accommodation', selectors: [tourism('hotel')], synonyms: ['hotels'] },
  { term: 'hostel', category: 'accommodation', selectors: [tourism('hostel')] },

  // leisure
  {
    term: 'leisure',
    category: 'leisure',
    selectors: [present('leisure')],
    synonyms: ['recreation'],
  },
  { term: 'park', category: 'leisure', selectors: [leisure('park')], synonyms: ['parks'] },
  {
    term: 'gym',
    category: 'leisure',
    selectors: [leisure('fitness_centre'), leisure('sports_centre')],
    synonyms: ['fitness', 'fitness centre', 'gymnasium'],
  },
  {
    term: 'cinema',
    category: 'leisure',
    selectors: [a('cinema')],
    synonyms: ['movie theater', 'movie theatre', 'movies'],
  },
  { term: 'playground', category: 'leisure', selectors: [leisure('playground')] },

  // tourism
  {
    term: 'tourism',
    category: 'tourism',
    selectors: [present('tourism')],
    synonyms: ['attractions', 'sights', 'things to do'],
  },
  { term: 'museum', category: 'tourism', selectors: [tourism('museum')], synonyms: ['museums'] },
  { term: 'viewpoint', category: 'tourism', selectors: [tourism('viewpoint')] },

  // worship
  {
    term: 'worship',
    category: 'worship',
    selectors: [a('place_of_worship')],
    synonyms: ['place of worship', 'church', 'mosque', 'temple', 'synagogue'],
  },

  // public_service
  {
    term: 'public_service',
    category: 'public_service',
    selectors: [a('police'), a('fire_station'), a('post_office'), a('townhall')],
    synonyms: ['public services', 'government', 'civic'],
  },
  {
    term: 'police',
    category: 'public_service',
    selectors: [a('police')],
    synonyms: ['police station'],
  },
  {
    term: 'post office',
    category: 'public_service',
    selectors: [a('post_office')],
    synonyms: ['postal'],
  },
  { term: 'fire station', category: 'public_service', selectors: [a('fire_station')] },

  // utility
  {
    term: 'utility',
    category: 'utility',
    selectors: [a('toilets'), a('drinking_water'), a('recycling'), a('post_box')],
    synonyms: ['utilities'],
  },
  {
    term: 'toilets',
    category: 'utility',
    selectors: [a('toilets')],
    synonyms: ['toilet', 'restroom', 'restrooms', 'wc', 'public toilet', 'bathroom'],
  },
  {
    term: 'drinking water',
    category: 'utility',
    selectors: [a('drinking_water')],
    synonyms: ['water fountain', 'water point'],
  },

  // other (catch-all; not directly queryable)
  { term: 'other', category: 'other', selectors: [] },
];

const normalize = (term: string): string => term.trim().toLowerCase().replace(/\s+/g, ' ');

const TERM_INDEX = new Map<string, TermDefinition>();
for (const def of TERMS) {
  TERM_INDEX.set(normalize(def.term), def);
  for (const synonym of def.synonyms ?? []) TERM_INDEX.set(normalize(synonym), def);
}

const selectorKey = (s: CategorySelector): string => `${s.key}|${s.value ?? ''}|${s.regex ? 1 : 0}`;

export interface ResolvedCategories {
  /** Deduplicated selectors for all recognized terms. */
  selectors: CategorySelector[];
  /** Recognized terms with their canonical name and category. */
  matched: { input: string; term: string; category: Category }[];
  /** Terms that could not be resolved. */
  unknown: string[];
}

/** Resolve a list of natural-language terms (or category names) to selectors. */
export function resolveCategories(terms: readonly string[]): ResolvedCategories {
  const selectors: CategorySelector[] = [];
  const seen = new Set<string>();
  const matched: ResolvedCategories['matched'] = [];
  const unknown: string[] = [];

  for (const input of terms) {
    const def = TERM_INDEX.get(normalize(input));
    if (!def) {
      unknown.push(input);
      continue;
    }
    matched.push({ input, term: def.term, category: def.category });
    for (const selector of def.selectors) {
      const key = selectorKey(selector);
      if (!seen.has(key)) {
        seen.add(key);
        selectors.push(selector);
      }
    }
  }
  return { selectors, matched, unknown };
}

/** Is `term` a known category or synonym? */
export function isKnownTerm(term: string): boolean {
  return TERM_INDEX.has(normalize(term));
}

/** All canonical query terms with their top-level category. */
export function categoryVocabulary(): { term: string; category: Category }[] {
  return TERMS.map(({ term, category }) => ({ term, category }));
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[n]!;
}

/** Suggest known terms for an unrecognized input (typos, partial matches). */
export function suggestCategories(term: string, limit = 5): string[] {
  const query = normalize(term);
  const scored: { term: string; score: number }[] = [];
  for (const def of TERMS) {
    const candidates = [def.term, ...(def.synonyms ?? [])].map(normalize);
    let best = Infinity;
    for (const candidate of candidates) {
      if (candidate.includes(query) || query.includes(candidate)) best = Math.min(best, 0);
      else best = Math.min(best, editDistance(query, candidate));
    }
    if (best <= 2) scored.push({ term: def.term, score: best });
  }
  scored.sort((x, y) => x.score - y.score || x.term.localeCompare(y.term));
  return scored.slice(0, limit).map((s) => s.term);
}

/** Render a selector as an Overpass tag filter, e.g. `["amenity"="cafe"]`. */
export function selectorToOverpassFilter(selector: CategorySelector): string {
  if (selector.value === undefined) return `["${selector.key}"]`;
  const op = selector.regex ? '~' : '=';
  return `["${selector.key}"${op}"${selector.value}"]`;
}

/** Does a tag set satisfy a single selector? */
export function tagsMatchSelector(
  tags: Record<string, string>,
  selector: CategorySelector,
): boolean {
  const value = tags[selector.key];
  if (value === undefined) return false;
  if (selector.value === undefined) return true;
  return selector.regex ? new RegExp(selector.value).test(value) : value === selector.value;
}

/** Does a tag set satisfy any of the selectors? */
export function tagsMatchAnySelector(
  tags: Record<string, string>,
  selectors: readonly CategorySelector[],
): boolean {
  return selectors.some((selector) => tagsMatchSelector(tags, selector));
}

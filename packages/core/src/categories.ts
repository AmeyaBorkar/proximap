import { CATEGORIES, type Category } from './types';

/**
 * OSM `amenity=*` values grouped by normalized category. Kept as the readable
 * source for the flattened lookup built below.
 */
const AMENITY_GROUPS = {
  food: ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court', 'biergarten', 'ice_cream'],
  healthcare: [
    'hospital',
    'clinic',
    'doctors',
    'dentist',
    'pharmacy',
    'veterinary',
    'nursing_home',
  ],
  education: ['school', 'college', 'university', 'kindergarten', 'library', 'language_school'],
  finance: ['bank', 'atm', 'bureau_de_change'],
  fuel: ['fuel', 'charging_station'],
  parking: ['parking', 'bicycle_parking', 'motorcycle_parking', 'parking_entrance'],
  transport: [
    'bus_station',
    'taxi',
    'ferry_terminal',
    'car_rental',
    'bicycle_rental',
    'car_sharing',
  ],
  worship: ['place_of_worship'],
  public_service: [
    'police',
    'fire_station',
    'post_office',
    'townhall',
    'courthouse',
    'community_centre',
  ],
  leisure: ['cinema', 'theatre', 'nightclub', 'arts_centre'],
  shopping: ['marketplace'],
  utility: [
    'toilets',
    'drinking_water',
    'shower',
    'recycling',
    'waste_disposal',
    'post_box',
    'telephone',
    'fountain',
    'shelter',
  ],
} satisfies Partial<Record<Category, string[]>>;

const AMENITY_TO_CATEGORY = new Map<string, Category>();
for (const [category, values] of Object.entries(AMENITY_GROUPS)) {
  for (const value of values) AMENITY_TO_CATEGORY.set(value, category as Category);
}

/** `shop=*` values that are really about groceries rather than retail. */
const GROCERY_SHOPS = new Set([
  'supermarket',
  'convenience',
  'greengrocer',
  'bakery',
  'butcher',
  'general',
  'deli',
  'farm',
  'dairy',
  'health_food',
]);

/** `tourism=*` values that represent places to stay. */
const LODGING_TOURISM = new Set([
  'hotel',
  'hostel',
  'guest_house',
  'motel',
  'apartment',
  'chalet',
  'camp_site',
  'caravan_site',
]);

/** `railway=*` values that are passenger access points. */
const TRANSPORT_RAILWAY = new Set(['station', 'halt', 'tram_stop', 'subway_entrance', 'stop']);

export interface Categorization {
  category: Category;
  /** The specific source value that drove the classification, if any. */
  kind?: string;
}

/**
 * Classify a set of OSM tags into a normalized {@link Category}. Keys are
 * checked in priority order; a present-but-unknown key falls back to 'other'
 * while preserving its value as `kind`.
 */
export function categorize(tags: Record<string, string>): Categorization {
  const {
    amenity,
    shop,
    tourism,
    leisure,
    healthcare,
    railway,
    public_transport,
    highway,
    aeroway,
    office,
  } = tags;

  if (amenity) {
    const category = AMENITY_TO_CATEGORY.get(amenity);
    return category ? { category, kind: amenity } : { category: 'other', kind: amenity };
  }
  if (shop) return { category: GROCERY_SHOPS.has(shop) ? 'grocery' : 'shopping', kind: shop };
  if (tourism)
    return { category: LODGING_TOURISM.has(tourism) ? 'accommodation' : 'tourism', kind: tourism };
  if (healthcare) return { category: 'healthcare', kind: healthcare };
  if (leisure) return { category: 'leisure', kind: leisure };
  if (railway && TRANSPORT_RAILWAY.has(railway)) return { category: 'transport', kind: railway };
  if (public_transport) return { category: 'transport', kind: public_transport };
  if (highway === 'bus_stop') return { category: 'transport', kind: 'bus_stop' };
  if (aeroway) return { category: 'transport', kind: aeroway };
  if (office)
    return {
      category: office === 'government' ? 'public_service' : 'other',
      kind: `office:${office}`,
    };
  return { category: 'other' };
}

/** Human-friendly display labels for each category. */
export const CATEGORY_LABELS: Record<Category, string> = {
  food: 'Food & drink',
  grocery: 'Groceries',
  shopping: 'Shopping',
  healthcare: 'Healthcare',
  education: 'Education',
  finance: 'Money',
  transport: 'Transport',
  fuel: 'Fuel & charging',
  parking: 'Parking',
  accommodation: 'Accommodation',
  leisure: 'Leisure',
  tourism: 'Tourism',
  worship: 'Places of worship',
  public_service: 'Public services',
  utility: 'Utilities',
  other: 'Other',
};

/** Type guard: is `value` one of the known {@link Category} names? */
export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

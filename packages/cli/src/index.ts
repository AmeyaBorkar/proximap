import {
  compareLocations,
  detectGaps,
  disambiguateLocation,
  findNearbyAmenities,
  ODBL_ATTRIBUTION,
  planErrands,
  reachableAmenities,
  toCSV,
  toGeoJSON,
  ValhallaRoutingProvider,
  walkabilityScore,
  type CategoryWeight,
  type FacetFilters,
  type TravelMode,
} from '@proximap/core';
import { Command } from 'commander';
import {
  renderComparison,
  renderErrands,
  renderGaps,
  renderGeocode,
  renderNearby,
  renderReachable,
  renderScore,
} from './render';

const VERSION = '0.1.0';

interface NearOptions {
  radius: string;
  category: string[];
  filter: string[];
  accessible?: boolean;
  openNow?: boolean;
  openAt?: string;
  by?: string;
  mode: string;
  explain?: boolean;
  limit: string;
  lang?: string;
  json?: boolean;
  format?: string;
}

interface GeocodeCommandOptions {
  limit: string;
  lang?: string;
  json?: boolean;
}

interface GapsCommandOptions {
  category: string[];
  radius: string;
  threshold: string;
  lang?: string;
  json?: boolean;
}

interface ScoreCommandOptions {
  ideal: string;
  max: string;
  lang?: string;
  json?: boolean;
}

interface CompareCommandOptions {
  weights?: string;
  ideal: string;
  max: string;
  lang?: string;
  json?: boolean;
}

interface ReachableCommandOptions {
  within: string;
  mode: string;
  category: string[];
  lang?: string;
  json?: boolean;
}

interface ErrandsCommandOptions {
  category: string[];
  mode: string;
  end?: string;
  candidates: string;
  radius: string;
  lang?: string;
  json?: boolean;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer (got "${value}")`);
  }
  return parsed;
}

const FALSY = new Set(['no', 'false', '0', '']);

const MODE_ALIASES: Record<string, TravelMode> = {
  walk: 'walk',
  walking: 'walk',
  foot: 'walk',
  bike: 'bike',
  cycling: 'bike',
  bicycle: 'bike',
  drive: 'drive',
  driving: 'drive',
  car: 'drive',
};

function parseMode(value: string): TravelMode {
  const mode = MODE_ALIASES[value.trim().toLowerCase()];
  if (!mode) throw new Error(`--mode must be walk, bike, or drive (got "${value}")`);
  return mode;
}

/** Parse a time budget like "15", "15min", or "15 minutes" into minutes. */
function parseWithin(value: string): number {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes)?$/);
  const minutes = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error(`--within must be a positive number of minutes (got "${value}")`);
  }
  return minutes;
}

/** Parse repeatable `--filter key=value` (or bare `key`) pairs into FacetFilters. */
function parseFilters(pairs: string[]): FacetFilters {
  const filters: FacetFilters = {};
  const tags: Record<string, string | boolean> = {};
  const push = (field: 'diet' | 'cuisine' | 'payment', value: string): void => {
    if (!value) return;
    const existing = filters[field];
    filters[field] = existing
      ? [...(Array.isArray(existing) ? existing : [existing]), value]
      : value;
  };

  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    const key = (eq === -1 ? pair : pair.slice(0, eq)).trim().toLowerCase();
    const raw = eq === -1 ? '' : pair.slice(eq + 1).trim();
    const bool = eq === -1 ? true : !FALSY.has(raw.toLowerCase());

    switch (key) {
      case 'diet':
      case 'cuisine':
      case 'payment':
        push(key, raw);
        break;
      case 'wheelchair':
        filters.wheelchair = raw || 'yes';
        break;
      case 'wifi':
      case 'internet':
      case 'internet_access':
        filters.internetAccess = bool;
        break;
      case 'takeaway':
        filters.takeaway = bool;
        break;
      case 'delivery':
        filters.delivery = bool;
        break;
      case 'outdoor':
      case 'outdoor_seating':
        filters.outdoorSeating = bool;
        break;
      default:
        tags[key] = eq === -1 ? true : raw;
        break;
    }
  }
  if (Object.keys(tags).length > 0) filters.tags = tags;
  return filters;
}

async function runNear(query: string, options: NearOptions): Promise<void> {
  const radiusMeters = parsePositiveInt(options.radius, 'radius');
  const limit = parsePositiveInt(options.limit, 'limit');

  const filters = parseFilters(options.filter);
  const open = options.openAt ? { at: options.openAt } : options.openNow ? 'now' : undefined;
  const byTravelTime = options.by !== undefined && /time/i.test(options.by);
  const result = await findNearbyAmenities(query, {
    radiusMeters,
    limit,
    ...(options.category.length > 0 ? { categories: options.category } : {}),
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(options.accessible ? { accessible: true } : {}),
    ...(open ? { open } : {}),
    // Use the key-free public Valhalla engine for real road-network times; core
    // falls back to straight-line estimates if it is unavailable.
    ...(byTravelTime
      ? {
          rankBy: 'travelTime' as const,
          mode: parseMode(options.mode),
          routing: new ValhallaRoutingProvider(),
        }
      : {}),
    ...(options.explain ? { explain: true } : {}),
    ...(options.lang ? { language: options.lang } : {}),
  });

  if (options.format) {
    const format = options.format.toLowerCase();
    if (format === 'geojson')
      process.stdout.write(`${JSON.stringify(toGeoJSON(result), null, 2)}\n`);
    else if (format === 'csv') process.stdout.write(`${toCSV(result)}\n`);
    else throw new Error(`unknown --format "${options.format}" (use geojson or csv)`);
    // Keep the ODbL notice off stdout so the data stays pipeable to a file.
    process.stderr.write(`${ODBL_ATTRIBUTION}\n`);
    return;
  }

  const output = options.json ? JSON.stringify(result, null, 2) : renderNearby(result);
  process.stdout.write(`${output}\n`);
}

async function runGeocode(query: string, options: GeocodeCommandOptions): Promise<void> {
  const result = await disambiguateLocation(query, {
    limit: parsePositiveInt(options.limit, 'limit'),
    ...(options.lang ? { language: options.lang } : {}),
  });
  const output = options.json
    ? JSON.stringify(result, null, 2)
    : renderGeocode(result.candidates, result.ambiguous);
  process.stdout.write(`${output}\n`);
}

async function runGaps(query: string, options: GapsCommandOptions): Promise<void> {
  const searchRadiusMeters = parsePositiveInt(options.radius, 'radius');
  const thresholdMeters = parsePositiveInt(options.threshold, 'threshold');
  const report = await detectGaps(query, {
    searchRadiusMeters,
    thresholdMeters,
    ...(options.category.length > 0 ? { categories: options.category } : {}),
    ...(options.lang ? { language: options.lang } : {}),
  });
  const output = options.json ? JSON.stringify(report, null, 2) : renderGaps(report);
  process.stdout.write(`${output}\n`);
}

async function runScore(query: string, options: ScoreCommandOptions): Promise<void> {
  const idealMeters = parsePositiveInt(options.ideal, 'ideal');
  const maxMeters = parsePositiveInt(options.max, 'max');
  if (maxMeters <= idealMeters) {
    throw new Error('--max must be greater than --ideal');
  }
  const report = await walkabilityScore(query, {
    decay: { idealMeters, maxMeters },
    ...(options.lang ? { language: options.lang } : {}),
  });
  const output = options.json ? JSON.stringify(report, null, 2) : renderScore(report);
  process.stdout.write(`${output}\n`);
}

/** Parse `term=weight,term=weight` into CategoryWeight[]. */
function parseWeights(spec: string): CategoryWeight[] {
  const weights: CategoryWeight[] = [];
  for (const part of spec.split(',')) {
    const [term, value] = part.split('=');
    const name = (term ?? '').trim();
    const weight = Number(value);
    if (!name || !Number.isFinite(weight) || weight <= 0) {
      throw new Error(`invalid --weights entry: "${part}" (use term=weight, e.g. food=2)`);
    }
    weights.push({ term: name, weight });
  }
  if (weights.length === 0) throw new Error('--weights needs at least one term=weight');
  return weights;
}

async function runCompare(queries: string[], options: CompareCommandOptions): Promise<void> {
  const idealMeters = parsePositiveInt(options.ideal, 'ideal');
  const maxMeters = parsePositiveInt(options.max, 'max');
  if (maxMeters <= idealMeters) {
    throw new Error('--max must be greater than --ideal');
  }
  const categories = options.weights ? parseWeights(options.weights) : undefined;
  const report = await compareLocations(queries, {
    decay: { idealMeters, maxMeters },
    ...(categories ? { categories } : {}),
    ...(options.lang ? { language: options.lang } : {}),
  });
  const output = options.json ? JSON.stringify(report, null, 2) : renderComparison(report);
  process.stdout.write(`${output}\n`);
}

async function runReachable(query: string, options: ReachableCommandOptions): Promise<void> {
  const result = await reachableAmenities(query, {
    within: parseWithin(options.within),
    mode: parseMode(options.mode),
    routing: new ValhallaRoutingProvider(),
    ...(options.category.length > 0 ? { categories: options.category } : {}),
    ...(options.lang ? { language: options.lang } : {}),
  });
  const output = options.json ? JSON.stringify(result, null, 2) : renderReachable(result);
  process.stdout.write(`${output}\n`);
}

async function runErrands(query: string, options: ErrandsCommandOptions): Promise<void> {
  if (options.category.length === 0) {
    throw new Error('errands needs at least one -c/--category');
  }
  const plan = await planErrands(query, {
    categories: options.category,
    mode: parseMode(options.mode),
    candidatesPerCategory: parsePositiveInt(options.candidates, 'candidates'),
    searchRadiusMeters: parsePositiveInt(options.radius, 'radius'),
    ...(options.end ? { end: options.end } : {}),
    ...(options.lang ? { language: options.lang } : {}),
  });
  const output = options.json ? JSON.stringify(plan, null, 2) : renderErrands(plan);
  process.stdout.write(`${output}\n`);
}

function fail(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`proximap: ${message}\n`);
  process.exit(1);
}

const program = new Command();
program
  .name('proximap')
  .description('Find and rank what is near any place — powered by OpenStreetMap.')
  .version(VERSION)
  .showHelpAfterError('(run with --help for usage)');

program
  .command('near')
  .description('list nearby amenities ranked by distance')
  .argument('<query...>', 'place name, address, or "lat,lng"')
  .option('-r, --radius <meters>', 'search radius in metres', '1000')
  .option(
    '-c, --category <term>',
    'restrict to a category or term, e.g. coffee (repeatable)',
    collect,
    [],
  )
  .option(
    '-f, --filter <key=value>',
    'facet filter, e.g. diet=vegan, payment=contactless, wifi (repeatable)',
    collect,
    [],
  )
  .option('--accessible', 'rank step-free / wheelchair-accessible places first')
  .option('--open-now', 'keep only places open right now (unknown hours kept, labelled)')
  .option('--open-at <when>', 'keep only places open at an ISO time, e.g. 2026-06-20T21:00')
  .option('--by <metric>', 'rank by distance (default) or travel-time')
  .option('--mode <mode>', 'travel mode for --by travel-time: walk, bike, drive', 'walk')
  .option('--explain', 'annotate each result with a short ranking reason')
  .option('-n, --limit <count>', 'maximum number of results', '20')
  .option('--lang <code>', 'preferred language for place names (e.g. en)')
  .option('--json', 'output raw JSON instead of a list')
  .option('--format <type>', 'export results as geojson or csv (ODbL notice on stderr)')
  .action((parts: string[], options: NearOptions) => runNear(parts.join(' '), options));

program
  .command('geocode')
  .description('resolve a place name to coordinates')
  .argument('<query...>', 'place name or address')
  .option('-n, --limit <count>', 'maximum number of candidates', '5')
  .option('--lang <code>', 'preferred language')
  .option('--json', 'output raw JSON')
  .action((parts: string[], options: GeocodeCommandOptions) =>
    runGeocode(parts.join(' '), options),
  );

program
  .command('gaps')
  .description('report which everyday amenities are missing near a place')
  .argument('<query...>', 'place name, address, or "lat,lng"')
  .option(
    '-c, --category <term>',
    'category to check (repeatable; default: daily needs)',
    collect,
    [],
  )
  .option('-r, --radius <meters>', 'how far to search for the nearest match', '5000')
  .option('-t, --threshold <meters>', 'distance beyond which a category is a gap', '1500')
  .option('--lang <code>', 'preferred language')
  .option('--json', 'output raw JSON')
  .action((parts: string[], options: GapsCommandOptions) => runGaps(parts.join(' '), options));

program
  .command('score')
  .description('rate how walkable / well-served a place is (0-100, with a breakdown)')
  .argument('<query...>', 'place name, address, or "lat,lng"')
  .option('--ideal <meters>', 'distance that still scores full marks (≈5-min walk)', '400')
  .option('--max <meters>', 'distance beyond which a category scores zero (≈30-min walk)', '2400')
  .option('--lang <code>', 'preferred language')
  .option('--json', 'output raw JSON')
  .action((parts: string[], options: ScoreCommandOptions) => runScore(parts.join(' '), options));

program
  .command('reachable')
  .description('list amenities reachable within a time budget (isochrone)')
  .argument('<query...>', 'place name, address, or "lat,lng"')
  .option('--within <minutes>', 'time budget, e.g. 15 or 15min', '15')
  .option('--mode <mode>', 'travel mode: walk, bike, drive', 'walk')
  .option('-c, --category <term>', 'restrict to a category or term (repeatable)', collect, [])
  .option('--lang <code>', 'preferred language')
  .option('--json', 'output raw JSON')
  .action((parts: string[], options: ReachableCommandOptions) =>
    runReachable(parts.join(' '), options),
  );

program
  .command('errands')
  .description('plan the shortest trip that hits one of each category')
  .argument('<query...>', 'starting place name, address, or "lat,lng"')
  .option('-c, --category <term>', 'a category to hit one of (repeatable, required)', collect, [])
  .option('--mode <mode>', 'travel mode: walk, bike, drive', 'walk')
  .option('--end <place>', 'optional fixed end point')
  .option('--candidates <count>', 'nearest candidates considered per category', '5')
  .option('-r, --radius <meters>', 'how far to look for candidates', '3000')
  .option('--lang <code>', 'preferred language')
  .option('--json', 'output raw JSON')
  .action((parts: string[], options: ErrandsCommandOptions) =>
    runErrands(parts.join(' '), options),
  );

program
  .command('compare')
  .description('compare 2+ locations by access to what you care about')
  .argument('<locations...>', 'two or more quoted place names, addresses, or "lat,lng"')
  .option(
    '-w, --weights <list>',
    'comma list term=weight, e.g. food=2,transport=3 (default: daily needs)',
  )
  .option('--ideal <meters>', 'distance that still scores full marks', '400')
  .option('--max <meters>', 'distance beyond which a category scores zero', '2400')
  .option('--lang <code>', 'preferred language')
  .option('--json', 'output raw JSON')
  .action((locations: string[], options: CompareCommandOptions) => runCompare(locations, options));

program.parseAsync().catch(fail);

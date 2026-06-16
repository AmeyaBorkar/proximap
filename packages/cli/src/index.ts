import {
  detectGaps,
  findNearbyAmenities,
  NominatimGeocoder,
  walkabilityScore,
  type FacetFilters,
  type GeocodeOptions,
} from '@proximap/core';
import { Command } from 'commander';
import { renderGaps, renderGeocode, renderNearby, renderScore } from './render';

const VERSION = '0.1.0';

interface NearOptions {
  radius: string;
  category: string[];
  filter: string[];
  accessible?: boolean;
  limit: string;
  lang?: string;
  json?: boolean;
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
  const result = await findNearbyAmenities(query, {
    radiusMeters,
    limit,
    ...(options.category.length > 0 ? { categories: options.category } : {}),
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(options.accessible ? { accessible: true } : {}),
    ...(options.lang ? { language: options.lang } : {}),
  });

  const output = options.json ? JSON.stringify(result, null, 2) : renderNearby(result);
  process.stdout.write(`${output}\n`);
}

async function runGeocode(query: string, options: GeocodeCommandOptions): Promise<void> {
  const geocodeOptions: GeocodeOptions = { limit: parsePositiveInt(options.limit, 'limit') };
  if (options.lang) geocodeOptions.language = options.lang;

  const places = await new NominatimGeocoder().geocode(query, geocodeOptions);
  const output = options.json ? JSON.stringify(places, null, 2) : renderGeocode(places);
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
  .option('-n, --limit <count>', 'maximum number of results', '20')
  .option('--lang <code>', 'preferred language for place names (e.g. en)')
  .option('--json', 'output raw JSON instead of a list')
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

program.parseAsync().catch(fail);

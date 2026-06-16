import {
  CATEGORIES,
  findNearbyAmenities,
  isCategory,
  NominatimGeocoder,
  type Category,
  type GeocodeOptions,
} from '@proximap/core';
import { Command } from 'commander';
import { renderGeocode, renderNearby } from './render';

const VERSION = '0.1.0';

interface NearOptions {
  radius: string;
  category: string[];
  limit: string;
  lang?: string;
  json?: boolean;
}

interface GeocodeCommandOptions {
  limit: string;
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

function validateCategories(values: string[]): Category[] {
  const invalid = values.filter((value) => !isCategory(value));
  if (invalid.length > 0) {
    throw new Error(
      `Unknown categor${invalid.length > 1 ? 'ies' : 'y'}: ${invalid.join(', ')}\n` +
        `Valid categories: ${CATEGORIES.join(', ')}`,
    );
  }
  return values as Category[];
}

async function runNear(query: string, options: NearOptions): Promise<void> {
  const radiusMeters = parsePositiveInt(options.radius, 'radius');
  const limit = parsePositiveInt(options.limit, 'limit');
  const categories = validateCategories(options.category);

  const result = await findNearbyAmenities(query, {
    radiusMeters,
    limit,
    ...(categories.length > 0 ? { categories } : {}),
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
  .option('-c, --category <name>', 'restrict to a category (repeatable)', collect, [])
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

program.parseAsync().catch(fail);

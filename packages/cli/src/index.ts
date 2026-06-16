import {
  detectGaps,
  findNearbyAmenities,
  NominatimGeocoder,
  type GeocodeOptions,
} from '@proximap/core';
import { Command } from 'commander';
import { renderGaps, renderGeocode, renderNearby } from './render';

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

interface GapsCommandOptions {
  category: string[];
  radius: string;
  threshold: string;
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

async function runNear(query: string, options: NearOptions): Promise<void> {
  const radiusMeters = parsePositiveInt(options.radius, 'radius');
  const limit = parsePositiveInt(options.limit, 'limit');

  const result = await findNearbyAmenities(query, {
    radiusMeters,
    limit,
    ...(options.category.length > 0 ? { categories: options.category } : {}),
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

program.parseAsync().catch(fail);

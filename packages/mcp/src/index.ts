import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  categoryVocabulary,
  compareLocations,
  detectGaps,
  disambiguateLocation,
  findNearbyAmenities,
  planErrands,
  reachableAmenities,
  ValhallaRoutingProvider,
  walkabilityScore,
} from '@proximap/core';
import { z } from 'zod';
import {
  toComparePayload,
  toDisambiguationPayload,
  toErrandsPayload,
  toGapsPayload,
  toNearbyPayload,
  toReachablePayload,
  toScorePayload,
} from './payload';

const VERSION = '1.0.1';

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

const server = new McpServer({ name: 'proximap', version: VERSION });

server.registerTool(
  'find_nearby_amenities',
  {
    title: 'Find nearby amenities',
    description:
      'Find amenities, utilities, and points of interest near a place, ranked by distance. ' +
      'Accepts a place name, an address, or a "lat,lng" string. Powered by OpenStreetMap.',
    inputSchema: {
      query: z.string().describe('Place name, address, or "lat,lng" coordinates'),
      radiusMeters: z
        .number()
        .positive()
        .optional()
        .describe('Search radius in metres (default 1000)'),
      categories: z
        .array(z.string())
        .optional()
        .describe('Restrict to categories or terms, e.g. coffee, pharmacy, petrol'),
      filters: z
        .object({
          diet: z.union([z.string(), z.array(z.string())]).optional(),
          cuisine: z.union([z.string(), z.array(z.string())]).optional(),
          payment: z.union([z.string(), z.array(z.string())]).optional(),
          internetAccess: z.boolean().optional(),
          outdoorSeating: z.boolean().optional(),
          takeaway: z.boolean().optional(),
          delivery: z.boolean().optional(),
          wheelchair: z.union([z.string(), z.array(z.string())]).optional(),
        })
        .optional()
        .describe('Facet filters: diet/cuisine/payment, wifi, takeaway, wheelchair, etc.'),
      accessible: z
        .boolean()
        .optional()
        .describe('Rank step-free / wheelchair-accessible places first'),
      open: z
        .string()
        .optional()
        .describe(
          'Keep only places open at this time: "now", or an ISO datetime like ' +
            '"2026-06-20T21:00". Unknown-hours places are kept and labelled.',
        ),
      rankBy: z
        .enum(['distance', 'travelTime'])
        .optional()
        .describe('Order by straight-line distance (default) or road-network travel time'),
      mode: z
        .enum(['walk', 'bike', 'drive'])
        .optional()
        .describe('Travel mode for rankBy=travelTime (default walk)'),
      explain: z
        .boolean()
        .optional()
        .describe('Add a short ranking reason / summary to each result'),
      concise: z
        .boolean()
        .optional()
        .describe('Return a slim, high-signal payload (with a one-line summary) for token economy'),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Maximum number of results (default 30)'),
      language: z.string().optional().describe('Preferred language for names, e.g. "en"'),
    },
  },
  async ({
    query,
    radiusMeters,
    categories,
    filters,
    accessible,
    open,
    rankBy,
    mode,
    explain,
    concise,
    limit,
    language,
  }) => {
    try {
      const openOption = open === 'now' ? 'now' : open ? { at: open } : undefined;
      // Concise mode needs the per-result summary, so it implies explain.
      const explainOn = Boolean(explain || concise);
      const result = await findNearbyAmenities(query, {
        ...(radiusMeters ? { radiusMeters } : {}),
        ...(categories ? { categories } : {}),
        ...(filters ? { filters } : {}),
        ...(accessible ? { accessible } : {}),
        ...(openOption ? { open: openOption } : {}),
        // Travel-time ranking uses the key-free public Valhalla engine.
        ...(rankBy === 'travelTime'
          ? {
              rankBy: 'travelTime' as const,
              routing: new ValhallaRoutingProvider(),
              ...(mode ? { mode } : {}),
            }
          : {}),
        ...(explainOn ? { explain: true } : {}),
        ...(limit ? { limit } : {}),
        ...(language ? { language } : {}),
      });
      return jsonResult(toNearbyPayload(result, { concise: Boolean(concise) }));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'geocode',
  {
    title: 'Geocode a place',
    description:
      'Resolve a place name or address to coordinates using OpenStreetMap. Returns the best ' +
      'guess plus ranked candidates, and an `ambiguous` flag when several distinct places share ' +
      'the name (e.g. the many "Springfield"s) — present the candidates instead of guessing.',
    inputSchema: {
      query: z.string().describe('Place name or address to look up'),
      limit: z.number().int().positive().optional().describe('Maximum candidates (default 5)'),
      language: z.string().optional().describe('Preferred language, e.g. "en"'),
    },
  },
  async ({ query, limit, language }) => {
    try {
      const result = await disambiguateLocation(query, {
        limit: limit ?? 5,
        ...(language ? { language } : {}),
      });
      return jsonResult(toDisambiguationPayload(result));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'list_categories',
  {
    title: 'List categories',
    description:
      'List the category terms proximap understands, for use with find_nearby_amenities. ' +
      'Returns each canonical term and its top-level category.',
    inputSchema: {},
  },
  async () => jsonResult(categoryVocabulary()),
);

server.registerTool(
  'detect_amenity_gaps',
  {
    title: 'Detect amenity gaps',
    description:
      'Report which everyday amenities are missing or far from a place — a "what is absent" check. ' +
      'Absence is framed as "not found in OSM within the threshold", not asserted as ground truth.',
    inputSchema: {
      query: z.string().describe('Place name, address, or "lat,lng" coordinates'),
      categories: z
        .array(z.string())
        .optional()
        .describe('Category terms to check (defaults to everyday needs)'),
      searchRadiusMeters: z
        .number()
        .positive()
        .optional()
        .describe('How far to search for the nearest match (default 5000)'),
      thresholdMeters: z
        .number()
        .positive()
        .optional()
        .describe('Distance beyond which a category is a gap (default 1500)'),
      language: z.string().optional().describe('Preferred language for names'),
    },
  },
  async ({ query, categories, searchRadiusMeters, thresholdMeters, language }) => {
    try {
      const report = await detectGaps(query, {
        ...(categories ? { categories } : {}),
        ...(searchRadiusMeters ? { searchRadiusMeters } : {}),
        ...(thresholdMeters ? { thresholdMeters } : {}),
        ...(language ? { language } : {}),
      });
      return jsonResult(toGapsPayload(report));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'walkability_score',
  {
    title: 'Walkability score',
    description:
      'Rate how walkable / well-served a location is on a 0-100 scale, with a transparent ' +
      'per-category breakdown (nearest distance + sub-score), the categories missing nearby, ' +
      'and a confidence note reflecting OSM data density. An open, tunable alternative to ' +
      'proprietary walkability indices.',
    inputSchema: {
      query: z.string().describe('Place name, address, or "lat,lng" coordinates'),
      idealMeters: z
        .number()
        .positive()
        .optional()
        .describe('Distance still scoring full marks, ≈5-min walk (default 400)'),
      maxMeters: z
        .number()
        .positive()
        .optional()
        .describe('Distance scoring zero, ≈30-min walk (default 2400)'),
      language: z.string().optional().describe('Preferred language for names'),
    },
  },
  async ({ query, idealMeters, maxMeters, language }) => {
    try {
      const decay: { idealMeters?: number; maxMeters?: number } = {};
      if (idealMeters) decay.idealMeters = idealMeters;
      if (maxMeters) decay.maxMeters = maxMeters;
      const report = await walkabilityScore(query, {
        ...(Object.keys(decay).length > 0 ? { decay } : {}),
        ...(language ? { language } : {}),
      });
      return jsonResult(toScorePayload(report));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'compare_locations',
  {
    title: 'Compare locations',
    description:
      'Compare two or more candidate locations (e.g. places to live) by access to weighted ' +
      'daily-need categories, returning a ranked scorecard with a per-dimension winner and a ' +
      'confidence note. Key-free and OSM-native. Out of scope (not in OSM): transit frequency, ' +
      'school quality, crime, prices.',
    inputSchema: {
      locations: z
        .array(z.string())
        .min(2)
        .describe('Two or more place names, addresses, or "lat,lng" strings'),
      weights: z
        .record(z.string(), z.number().positive())
        .optional()
        .describe('Category term to weight, e.g. { "food": 2, "transport": 3 }'),
      idealMeters: z.number().positive().optional().describe('Full-marks distance (default 400)'),
      maxMeters: z.number().positive().optional().describe('Zero-score distance (default 2400)'),
      language: z.string().optional().describe('Preferred language for names'),
    },
  },
  async ({ locations, weights, idealMeters, maxMeters, language }) => {
    try {
      const categories = weights
        ? Object.entries(weights).map(([term, weight]) => ({ term, weight }))
        : undefined;
      const decay: { idealMeters?: number; maxMeters?: number } = {};
      if (idealMeters) decay.idealMeters = idealMeters;
      if (maxMeters) decay.maxMeters = maxMeters;
      const report = await compareLocations(locations, {
        ...(categories ? { categories } : {}),
        ...(Object.keys(decay).length > 0 ? { decay } : {}),
        ...(language ? { language } : {}),
      });
      return jsonResult(toComparePayload(report));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'reachable_amenities',
  {
    title: 'Reachable amenities',
    description:
      'List the amenities reachable within a time budget (e.g. a 15-minute walk) using a real ' +
      'isochrone where available, falling back to a travel-time threshold. Returns the filtered, ' +
      'time-sorted amenity list (the answer), plus the isochrone polygon. Powered by OpenStreetMap ' +
      '+ the key-free Valhalla engine.',
    inputSchema: {
      query: z.string().describe('Place name, address, or "lat,lng" coordinates'),
      within: z.number().positive().describe('Time budget in minutes (e.g. 15)'),
      mode: z.enum(['walk', 'bike', 'drive']).optional().describe('Travel mode (default walk)'),
      categories: z
        .array(z.string())
        .optional()
        .describe('Restrict to categories or terms, e.g. grocery, pharmacy'),
      language: z.string().optional().describe('Preferred language for names'),
    },
  },
  async ({ query, within, mode, categories, language }) => {
    try {
      const result = await reachableAmenities(query, {
        within,
        routing: new ValhallaRoutingProvider(),
        ...(mode ? { mode } : {}),
        ...(categories ? { categories } : {}),
        ...(language ? { language } : {}),
      });
      return jsonResult(toReachablePayload(result));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'plan_errands',
  {
    title: 'Plan errands',
    description:
      'Plan the shortest trip from an origin that visits one of each requested category ' +
      '(e.g. a pharmacy AND an ATM AND a grocery) — the Generalized-TSP "pick one per set, then ' +
      'optimize" workflow. Returns the chosen places in visit order with per-leg and total travel. ' +
      'Categories with no candidate nearby are reported as missing, not faked.',
    inputSchema: {
      query: z.string().describe('Starting place name, address, or "lat,lng" coordinates'),
      categories: z
        .array(z.string())
        .min(1)
        .describe('Categories to hit one of each, e.g. ["pharmacy", "atm", "grocery"]'),
      mode: z.enum(['walk', 'bike', 'drive']).optional().describe('Travel mode (default walk)'),
      end: z.string().optional().describe('Optional fixed end point (place or "lat,lng")'),
      candidatesPerCategory: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Nearest candidates considered per category (default 5)'),
      language: z.string().optional().describe('Preferred language for names'),
    },
  },
  async ({ query, categories, mode, end, candidatesPerCategory, language }) => {
    try {
      const plan = await planErrands(query, {
        categories,
        ...(mode ? { mode } : {}),
        ...(end ? { end } : {}),
        ...(candidatesPerCategory ? { candidatesPerCategory } : {}),
        ...(language ? { language } : {}),
      });
      return jsonResult(toErrandsPayload(plan));
    } catch (error) {
      return errorResult(error);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`proximap MCP server ${VERSION} ready (stdio)\n`);

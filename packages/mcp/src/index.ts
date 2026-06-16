import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  categoryVocabulary,
  detectGaps,
  findNearbyAmenities,
  NominatimGeocoder,
  walkabilityScore,
} from '@proximap/core';
import { z } from 'zod';
import { toGapsPayload, toGeocodePayload, toNearbyPayload, toScorePayload } from './payload';

const VERSION = '0.1.0';

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
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Maximum number of results (default 30)'),
      language: z.string().optional().describe('Preferred language for names, e.g. "en"'),
    },
  },
  async ({ query, radiusMeters, categories, filters, accessible, open, limit, language }) => {
    try {
      const openOption = open === 'now' ? 'now' : open ? { at: open } : undefined;
      const result = await findNearbyAmenities(query, {
        ...(radiusMeters ? { radiusMeters } : {}),
        ...(categories ? { categories } : {}),
        ...(filters ? { filters } : {}),
        ...(accessible ? { accessible } : {}),
        ...(openOption ? { open: openOption } : {}),
        ...(limit ? { limit } : {}),
        ...(language ? { language } : {}),
      });
      return jsonResult(toNearbyPayload(result));
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
      'Resolve a place name or address to coordinates using OpenStreetMap. ' +
      'Returns ranked candidates with their full display names.',
    inputSchema: {
      query: z.string().describe('Place name or address to look up'),
      limit: z.number().int().positive().optional().describe('Maximum candidates (default 5)'),
      language: z.string().optional().describe('Preferred language, e.g. "en"'),
    },
  },
  async ({ query, limit, language }) => {
    try {
      const places = await new NominatimGeocoder().geocode(query, {
        limit: limit ?? 5,
        ...(language ? { language } : {}),
      });
      return jsonResult(toGeocodePayload(places));
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

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`proximap MCP server ${VERSION} ready (stdio)\n`);

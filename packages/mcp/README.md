# @proximap/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
[proximap](https://github.com/AmeyaBorkar/proximap) as tools for AI agents
(e.g. Claude). Powered by OpenStreetMap; no API keys required.

## Tools

- **`find_nearby_amenities`** — `{ query, radiusMeters?, categories?, filters?, accessible?,
  open?, rankBy?, mode?, explain?, concise?, limit?, language? }` → amenities near a place/`lat,lng`,
  ranked by distance or road-network travel time. Supports facet filters (diet/payment/wifi/wheelchair),
  accessibility-first ranking, open-now/open-at, a one-line `summary` per result, and a token-economy
  `concise` mode.
- **`geocode`** — `{ query, limit?, language? }` → the best guess plus ranked candidates and an
  `ambiguous` flag when several distinct places share the name (the many "Springfield"s) — present the
  candidates instead of guessing.
- **`list_categories`** — `{}` → the category terms proximap understands (for `find_nearby_amenities`).
- **`detect_amenity_gaps`** — `{ query, categories?, searchRadiusMeters?, thresholdMeters?, language? }`
  → which everyday amenities are missing or far, framed as "not found in OSM," never asserted as truth.
- **`walkability_score`** — `{ query, idealMeters?, maxMeters?, language? }` → a 0–100 score with a
  transparent per-category breakdown, the missing categories, and a data-confidence note.
- **`compare_locations`** — `{ locations[2+], weights?, idealMeters?, maxMeters?, language? }` → a ranked
  scorecard of candidate locations with a per-dimension winner.
- **`reachable_amenities`** — `{ query, within, mode?, categories?, language? }` → the amenities reachable
  within a time budget (real isochrone where available), plus the polygon.
- **`plan_errands`** — `{ query, categories[1+], mode?, end?, candidatesPerCategory?, language? }` → the
  shortest trip that visits one of each category (Generalized TSP), with the chosen places and totals.

All tools are powered by OpenStreetMap (+ the key-free Valhalla engine for travel time/isochrones) and
return compact JSON. Travel times and routing degrade gracefully to straight-line estimates if the
routing engine is unavailable.

## Install & run

```bash
npm install @proximap/mcp
proximap-mcp        # starts a stdio MCP server
```

## Register with an MCP client

```json
{
  "mcpServers": {
    "proximap": {
      "command": "proximap-mcp"
    }
  }
}
```

For Claude Code, add the snippet above to your `.mcp.json` (or use
`claude mcp add proximap proximap-mcp`).

## License

MIT

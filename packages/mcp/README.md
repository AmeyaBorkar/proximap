# @proximap/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
[proximap](https://github.com/AmeyaBorkar/proximap) as tools for AI agents
(e.g. Claude). Powered by OpenStreetMap; no API keys required.

## Tools

- **`find_nearby_amenities`** — `{ query, radiusMeters?, categories?, limit?, language? }`
  → amenities near a place/`lat,lng`, ranked by distance.
- **`geocode`** — `{ query, limit?, language? }` → ranked coordinate candidates.

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

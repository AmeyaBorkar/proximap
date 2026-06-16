# Roadmap

proximap starts with "what's near here, ranked?" and grows into a broader
geospatial toolkit. Ordering is indicative, not a commitment.

## Shipped — v0

- [x] Place / address / `lat,lng` → nearby amenities, ranked by distance
- [x] OpenStreetMap backends (Nominatim geocoding + Overpass POIs), no API keys
- [x] 16-category taxonomy with filtering
- [x] Pluggable `GeocodingProvider` / `PlacesProvider` interfaces
- [x] CLI: `near`, `geocode`
- [x] MCP server: `find_nearby_amenities`, `geocode`
- [x] Dependency-free core, dual ESM/CJS build, CI on Node 20 & 24

## Next

- [ ] **Travel-time ranking** — walking/driving/cycling distance & duration via
      OSRM (rank by minutes, not just metres)
- [ ] **Isochrones** — "what's reachable within N minutes"
- [ ] **Neighbourhood score** — amenity coverage by category for a location
- [ ] **Compare locations** — score two addresses by access to amenities
- [ ] **Reverse-geocode** CLI command; `--sort` / `--group-by-category` output
- [ ] **Export** — GeoJSON and CSV
- [ ] **Caching + polite rate limiting** for the OSM endpoints

## Later

- [ ] **More providers** (bring-your-own-key): Google Places, Mapbox, Foursquare
- [ ] **Python port → PyPI** (`pip install proximap`); the name is reserved
- [ ] **Web UI** (`apps/web`): map + search over `@proximap/core`
- [ ] **Claude Code plugin** packaging around the MCP server

Have an idea? See [CONTRIBUTING.md](CONTRIBUTING.md).

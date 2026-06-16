# @proximap/cli

The `proximap` command-line tool — find and rank what's near any place, powered
by OpenStreetMap. No API keys required.

## Install

```bash
npm install -g @proximap/cli
# or run without installing:
npx @proximap/cli near "Eiffel Tower, Paris"
```

## Usage

```bash
# Nearby amenities within 800 m, ranked by distance
proximap near "Eiffel Tower, Paris" --radius 800 --limit 20

# Filter by category, output JSON
proximap near "MG Road, Bengaluru" --category healthcare --category food --json

# Compose facets: a vegan place that does takeaway and accepts contactless
proximap near "Kreuzberg, Berlin" -c food --filter diet=vegan --filter takeaway --filter payment=contactless

# Accessibility-first: rank step-free / wheelchair-accessible places first
proximap near "Bahnhofstrasse, Zürich" -c food --accessible

# Only what's open right now (or at a future time); unknown hours are kept + labelled
proximap near "Shibuya, Tokyo" -c coffee --open-now
proximap near "Shibuya, Tokyo" -c food --open-at 2026-06-20T21:00

# Works with coordinates too
proximap near "48.8584,2.2945"

# Resolve a place to coordinates
proximap geocode "Sydney Opera House"

# What everyday amenities are MISSING nearby? (framed as "not found in OSM")
proximap gaps "Brandenburg Gate, Berlin" --radius 3000 --threshold 1000

# How walkable / well-served is this address? (0-100, with a breakdown)
proximap score "Brandenburg Gate, Berlin"

# Compare places to live by access to what you care about
proximap compare "Prenzlauer Berg, Berlin" "Marzahn, Berlin" --weights grocery=3,transport=2,park=2

# Export results for GIS / spreadsheets (OSM data is yours to store under ODbL)
proximap near "Eiffel Tower, Paris" -c food --format geojson > food.geojson
proximap near "Eiffel Tower, Paris" -c food --format csv > food.csv
```

Run `proximap --help` or `proximap <command> --help` for all options.

## License

MIT

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

# Works with coordinates too
proximap near "48.8584,2.2945"

# Resolve a place to coordinates
proximap geocode "Sydney Opera House"
```

Run `proximap --help` or `proximap near --help` for all options.

## License

MIT

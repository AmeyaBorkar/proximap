# proximap (Python port — planned)

A Python implementation of the proximap engine, targeting PyPI so the toolkit is
available to the Python ecosystem:

```bash
pip install proximap   # planned
```

**Not yet implemented.** The package name is reserved on PyPI and this directory
reserves the monorepo location. It will mirror `@proximap/core`'s design — the
same provider abstraction (`GeocodingProvider` / `PlacesProvider`), the same
normalized category taxonomy, and the same `find_nearby_amenities` entry point —
so behaviour stays consistent across languages.

Planned layout:

```
python/
  pyproject.toml
  src/proximap/__init__.py
  src/proximap/geo.py
  src/proximap/providers/...
```

See the [roadmap](../ROADMAP.md).

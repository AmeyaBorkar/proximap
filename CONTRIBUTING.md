# Contributing

Thanks for your interest in proximap!

## Setup

- Node 20+ (`.nvmrc` pins 24).
- `npm install` at the repo root (npm workspaces).

## Workflow

- `npm run check` must pass before you commit — it runs
  `build` + `typecheck` + `format:check` + `test`.
- `npm run format` auto-formats with Prettier.
- Tests live next to sources as `*.test.ts` and run under Vitest
  (`npm test` / `npm run test:watch`).
- Network providers are exercised against mocked `fetch`, so the suite is
  offline and deterministic.

## Commits

- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
  `chore:`, `docs:`, `ci:`, `test:`, `refactor:`.
- Keep each commit green and **bisectable** — it should build and pass on its own.
- No `Co-Authored-By` / collaborator trailers.

## Adding a data provider

Implement `GeocodingProvider` or `PlacesProvider` from `@proximap/core` and pass
it through `findNearbyAmenities(query, { geocoder, places })`. No changes to the
ranking pipeline are needed.

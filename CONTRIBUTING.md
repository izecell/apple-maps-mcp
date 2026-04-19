# Contributing

Thanks for your interest in `apple-maps-mcp`! This is a small, focused MCP
server and contributions are welcome.

## Development setup

Requirements:

- macOS (the URL-scheme tools open the system Maps.app)
- Node.js 20 or newer (Node 22+ recommended for native `--experimental-strip-types`)
- `npm`

```bash
git clone https://github.com/izecell/apple-maps-mcp.git
cd apple-maps-mcp
npm install
```

Run the server (no API key required — uses OSM/OSRM by default):

```bash
npm start
```

Run the type checker and tests:

```bash
npm run typecheck
npm test
```

## Project layout

```
src/
  index.ts        # MCP server: tool registration, Zod schemas, dispatch
  url-scheme.ts   # Builders + opener for maps://… URLs
  maps-api.ts     # Apple Maps Server API client (token exchange + caching)
  osm-api.ts      # Free Nominatim + OSRM fallback
tests/
  *.test.ts       # node:test unit tests, no network calls
```

## Coding guidelines

- TypeScript with `strict: true`. No `any` unless unavoidable; prefer narrow
  types and `unknown` at boundaries.
- ESM only (`"type": "module"`). Use the `.ts` extension in relative imports
  (`import { … } from "./foo.ts"`) — `tsconfig.json` has
  `allowImportingTsExtensions: true`.
- No build step. The server runs directly via
  `node --experimental-strip-types src/index.ts`.
- Validate every tool input with Zod in `src/index.ts`.
- Never log tokens or full request bodies that may contain secrets.

## Tests

- Tests use `node:test` (the built-in runner) and `node:assert/strict`.
- Tests must not hit the network. `osm-api.ts` and `maps-api.ts` make HTTP
  requests; only their pure helpers (URL building, coordinate parsing,
  duration formatting) are exercised in unit tests.
- Add a test for any new URL-scheme builder, schema, or helper.

```bash
npm test
```

## Pull requests

1. Fork and create a feature branch off `main`.
2. Keep PRs focused — one logical change per PR.
3. Update `CHANGELOG.md` under `## [Unreleased]` describing your change.
4. Update `README.md` if you add, remove, or change a tool.
5. Make sure `npm run typecheck` and `npm test` pass locally.
6. Open a PR with a clear description and a reproduction or example call
   for new tools.

## Reporting issues

Please include:

- macOS version
- Node.js version (`node --version`)
- Whether `APPLE_MAPS_AUTH_TOKEN` is set
- The exact tool call (name + arguments) and the error / unexpected output

For Apple Maps Server API errors, include the HTTP status code surfaced by
the server. **Do not paste your JWT or access token into issues.**

## Security

If you find a security issue (e.g. a way to escape the URL allowlist, an
injection vector in a tool argument, or a token-leaking code path), please
open a private security advisory on GitHub rather than a public issue.

## License

By contributing you agree that your contributions will be licensed under the
[MIT License](./LICENSE).

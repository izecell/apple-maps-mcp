# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses **CalVer**: version numbers follow `YYYY.M.PATCH` (e.g.
`2026.4.0` is the first release in April 2026; `2026.4.1` would be the next
patch in the same month). Tags are prefixed with `v`.

## [Unreleased]

## [2026.4.0] - 2026-04-19

Initial release.

### Added
- 5 URL-scheme tools that open Maps.app on macOS:
  `open_in_maps_search`, `open_in_maps_address`, `open_in_maps_pin`,
  `open_in_maps_directions`, `open_maps_url`.
- 6 data tools backed by the Apple Maps Server API (when
  `APPLE_MAPS_AUTH_TOKEN` is set) with a free OpenStreetMap / OSRM fallback
  when it is not: `geocode`, `reverse_geocode`, `search`,
  `search_autocomplete` (Apple-only; OSM degrades to top-5 search),
  `directions`, `eta`.
- Apple Maps token exchange + caching with a single `401` retry.
- Nominatim 1 req/s rate limit and descriptive `User-Agent`.
- OSRM driving / walking / cycling routing; transit requests degrade to
  driving with an explanatory note.
- URL allowlist (`maps://`, `https://maps.apple.com/`,
  `http://maps.apple.com/`) enforced before invoking `/usr/bin/open`, using
  `execFile` (not `exec`) to avoid shell interpolation.
- Zod-validated tool inputs.
- Unit tests for URL-scheme builders and OSM helper functions
  (`profileFromTransport`, `transitNote`, `parseLatLonToOsrm`,
  `humanDuration`).
- GitHub Actions CI: type check + unit tests on Node 22 and 24.
- Release workflow that publishes a GitHub Release on `vYYYY.M.PATCH` tags
  and extracts the matching `CHANGELOG.md` section as release notes.
- CalVer release scheme documented in `README.md`.

[Unreleased]: https://github.com/izecell/apple-maps-mcp/compare/v2026.4.0...HEAD
[2026.4.0]: https://github.com/izecell/apple-maps-mcp/releases/tag/v2026.4.0

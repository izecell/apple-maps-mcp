# apple-maps-mcp

[![Tests](https://github.com/izecell/apple-maps-mcp/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/izecell/apple-maps-mcp/actions/workflows/test.yml)
[![Node 22+](https://img.shields.io/badge/node-22+-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/github/v/release/izecell/apple-maps-mcp?label=release&color=22bfda)](https://github.com/izecell/apple-maps-mcp/releases)
[![CalVer](https://img.shields.io/badge/calver-yyyy.m.patch-22bfda.svg)](https://calver.org/)

An MCP server for Apple Maps on macOS. Opens Maps.app via URL schemes and answers
geocoding / search / directions / ETA queries — using the **Apple Maps Server API**
when an `APPLE_MAPS_AUTH_TOKEN` is set, or a **free OpenStreetMap + OSRM**
fallback when it isn't.

## Tools (11)

**URL-scheme (open Maps.app):** `open_in_maps_search`, `open_in_maps_address`,
`open_in_maps_pin`, `open_in_maps_directions`, `open_maps_url`

**Data (Apple Maps Server API → OSM/OSRM fallback):** `geocode`,
`reverse_geocode`, `search`, `search_autocomplete`, `directions`, `eta`

## Prerequisites

- macOS (Maps.app for the URL-scheme tools)
- Node.js 22 or later (uses native `--experimental-strip-types`, no build step)

## Installation

```bash
git clone https://github.com/izecell/apple-maps-mcp.git
cd apple-maps-mcp
npm install
```

## Configuration

### GitHub Copilot CLI

Add to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "apple-maps": {
      "command": "/opt/homebrew/bin/node",
      "args": [
        "--experimental-strip-types",
        "/absolute/path/to/apple-maps-mcp/src/index.ts"
      ],
      "env": {
        "APPLE_MAPS_AUTH_TOKEN": ""
      },
      "tools": ["*"]
    }
  }
}
```

Then reload servers in the CLI (e.g. via the `/mcp` menu) and the tools
appear under the `apple-maps-` prefix.

### Other MCP hosts

Use the same `command` / `args` / `env` shape — most hosts (Claude Desktop,
Zed, Cursor, etc.) accept this format inside their own `mcpServers` block.
On Intel Macs without Homebrew on `/opt/homebrew`, use the path printed by
`which node`.

Leave `APPLE_MAPS_AUTH_TOKEN` empty to use the free OpenStreetMap / OSRM
backend. Set it to a signed Maps Auth Token (JWT) to use the Apple Maps
Server API instead.

## Backends

| Backend                   | When                                | Strengths                              | Limits                                    |
|---------------------------|-------------------------------------|----------------------------------------|-------------------------------------------|
| Nominatim (OpenStreetMap) | `APPLE_MAPS_AUTH_TOKEN` not set     | Free, no signup                        | 1 request/second; no autocomplete         |
| OSRM public demo          | `APPLE_MAPS_AUTH_TOKEN` not set     | Free routing & ETA                     | No transit; no live traffic               |
| Apple Maps Server API     | `APPLE_MAPS_AUTH_TOKEN` set         | Better POIs, autocomplete, transit     | Apple Developer Program (~$99/yr)         |

### Generating an Apple Maps Auth Token

Requires an Apple Developer Program account.

1. Create a **Maps ID** at <https://developer.apple.com/account/resources/identifiers/list/maps>
   (e.g. `maps.com.example.cli`).
2. Create a **Maps Key** at <https://developer.apple.com/account/resources/authkeys/list>,
   attach the Maps ID, download the `.p8` (shown only once). Note the **Key ID**
   and **Team ID**.
3. Sign a Maps Auth Token (max 1 year). Easiest:
   <https://github.com/CovertLizard/jwt-maps>, or in Node:

   ```js
   import { SignJWT, importPKCS8 } from "jose";
   const pk = await importPKCS8(fs.readFileSync("AuthKey_XXXXXXXXXX.p8", "utf8"), "ES256");
   const authToken = await new SignJWT({})
     .setProtectedHeader({ alg: "ES256", kid: "<KEY_ID>", typ: "JWT" })
     .setIssuer("<TEAM_ID>")
     .setIssuedAt()
     .setExpirationTime("180d")
     .sign(pk);
   ```

The server exchanges this Auth Token for a short-lived Access Token at
`GET https://maps-api.apple.com/v1/token` and caches it until expiry.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # node:test, no network
npm run check-all   # both
npm start           # run the MCP server on stdio
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow, branch
convention, and PR process.

## Architecture

```
src/index.ts        — MCP server: tool registration, Zod schemas, dispatch
src/url-scheme.ts   — URL builders + safe Maps.app opener (allowlisted prefixes)
src/maps-api.ts     — Apple Maps Server API client (token exchange + cache)
src/osm-api.ts      — Free Nominatim + OSRM fallback
tests/              — node:test unit tests, no network calls
```

## Versioning

This project uses **CalVer** (`YYYY.M.PATCH`). Each release is tagged
`vYYYY.M.PATCH` (e.g. `v2026.4.0`) and a GitHub release is created
automatically by the `release.yml` workflow.

## Security

- Tokens are never logged.
- URL-scheme parameters are URL-encoded; `execFile` (not `exec`) is used to
  open Maps.app, with an allowlist of permitted URL prefixes
  (`maps://`, `https://maps.apple.com/`, `http://maps.apple.com/`).
- Read-only by default — no tool modifies Maps state.
- See [SECURITY.md](SECURITY.md) for the disclosure policy.

## License

[MIT](LICENSE)

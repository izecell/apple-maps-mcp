# Security Policy

## Supported versions

The latest released minor version is supported.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Instead, open a private security advisory:
<https://github.com/izecell/apple-maps-mcp/security/advisories/new>

Please include:

- A description of the issue and its impact
- Steps to reproduce (or a proof-of-concept)
- The version / commit SHA you tested against

You can expect an initial response within a few days. Coordinated disclosure
is appreciated.

## Hardening notes for users

- Treat `APPLE_MAPS_AUTH_TOKEN` like any other long-lived credential. Store
  it in a secret manager or your MCP host's environment, not in source
  control.
- The server will never log the token, but third-party MCP hosts may log
  environment variables — review your host's logging policy.
- The `open_maps_url` tool refuses any URL that does not start with one of
  the allowlisted prefixes (`maps://`, `https://maps.apple.com/`,
  `http://maps.apple.com/`). Do not relax this without a strong reason.

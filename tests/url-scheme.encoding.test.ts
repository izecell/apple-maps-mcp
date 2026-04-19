import { test } from "node:test";
import assert from "node:assert/strict";

import { urlForSearch, urlForPin, urlForDirections } from "../src/url-scheme.ts";

// These tests exercise builder behaviour that the safety guarantees rely on:
// - all parameters URL-encoded
// - allowlist enforcement is in openMapsUrl, not the builders (caller responsibility)

test("urlForSearch encodes ampersand without breaking the query string", () => {
  const u = urlForSearch("R&D office");
  // The "&" inside the q= value MUST be percent-encoded, otherwise it
  // would create a second URL parameter.
  assert.ok(u.includes("q=R%26D+office"), `unexpected URL: ${u}`);
  // Should still parse to a single q= param
  const params = new URL(u).searchParams;
  assert.equal(params.get("q"), "R&D office");
  assert.equal([...params.keys()].length, 1);
});

test("urlForPin embeds ll= as percent-encoded comma", () => {
  const u = urlForPin(48.2082, 16.3738);
  assert.ok(u.includes("ll=48.2082%2C16.3738"));
});

test("urlForDirections preserves all three params", () => {
  const u = urlForDirections("Vienna", "Salzburg", "driving");
  const params = new URL(u).searchParams;
  assert.equal(params.get("saddr"), "Vienna");
  assert.equal(params.get("daddr"), "Salzburg");
  assert.equal(params.get("dirflg"), "d");
});

test("urlForDirections encodes addresses containing reserved characters", () => {
  const u = urlForDirections(
    "Stephansplatz 1, 1010 Wien",
    "Café Sperl, Wien",
  );
  const params = new URL(u).searchParams;
  assert.equal(params.get("saddr"), "Stephansplatz 1, 1010 Wien");
  assert.equal(params.get("daddr"), "Café Sperl, Wien");
});

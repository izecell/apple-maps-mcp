import { test } from "node:test";
import assert from "node:assert/strict";

import {
  urlForSearch,
  urlForAddress,
  urlForPin,
  urlForDirections,
} from "../src/url-scheme.ts";

test("urlForSearch URL-encodes the query", () => {
  const u = urlForSearch("Café Sperl, Wien");
  assert.match(u, /^https:\/\/maps\.apple\.com\/\?/);
  assert.ok(u.includes("q=Caf%C3%A9+Sperl%2C+Wien"));
});

test("urlForAddress URL-encodes the address", () => {
  const u = urlForAddress("1 Apple Park Way, Cupertino, CA");
  assert.ok(u.includes("address=1+Apple+Park+Way%2C+Cupertino%2C+CA"));
});

test("urlForPin builds ll= and optional q=", () => {
  assert.equal(urlForPin(48.2082, 16.3738), "https://maps.apple.com/?ll=48.2082%2C16.3738");
  const labelled = urlForPin(48.2082, 16.3738, "Stephansdom");
  assert.ok(labelled.includes("ll=48.2082%2C16.3738"));
  assert.ok(labelled.includes("q=Stephansdom"));
});

test("urlForDirections uses dirflg=d/w/r", () => {
  assert.ok(urlForDirections("A", "B", "driving").includes("dirflg=d"));
  assert.ok(urlForDirections("A", "B", "walking").includes("dirflg=w"));
  assert.ok(urlForDirections("A", "B", "transit").includes("dirflg=r"));
});

test("urlForDirections defaults to driving", () => {
  assert.ok(urlForDirections("A", "B").includes("dirflg=d"));
});

test("urlForSearch rejects nothing — caller validates", () => {
  // The MCP server layer validates length & shape via Zod; the URL builder is permissive.
  const u = urlForSearch("");
  assert.ok(u.startsWith("https://maps.apple.com/?"));
});

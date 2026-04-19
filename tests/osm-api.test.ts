import { test } from "node:test";
import assert from "node:assert/strict";

import {
  profileFromTransport,
  transitNote,
  parseLatLonToOsrm,
  humanDuration,
} from "../src/osm-api.ts";

test("profileFromTransport maps walking variants", () => {
  assert.equal(profileFromTransport("Walking"), "walking");
  assert.equal(profileFromTransport("walking"), "walking");
});

test("profileFromTransport maps cycling variants", () => {
  assert.equal(profileFromTransport("Cycling"), "cycling");
  assert.equal(profileFromTransport("cycling"), "cycling");
});

test("profileFromTransport defaults to driving", () => {
  assert.equal(profileFromTransport(undefined), "driving");
  assert.equal(profileFromTransport("Automobile"), "driving");
  assert.equal(profileFromTransport("driving"), "driving");
});

test("profileFromTransport maps transit to driving (no transit profile in OSRM)", () => {
  assert.equal(profileFromTransport("Transit"), "driving");
  assert.equal(profileFromTransport("transit"), "driving");
});

test("transitNote returns a note only for transit", () => {
  assert.ok(transitNote("Transit"));
  assert.ok(transitNote("transit"));
  assert.equal(transitNote("Walking"), undefined);
  assert.equal(transitNote(undefined), undefined);
});

test("transitNote mentions APPLE_MAPS_AUTH_TOKEN as the upgrade path", () => {
  assert.match(transitNote("Transit")!, /APPLE_MAPS_AUTH_TOKEN/);
});

test("parseLatLonToOsrm flips lat,lon → lon,lat", () => {
  assert.equal(parseLatLonToOsrm("48.2082,16.3738"), "16.3738,48.2082");
});

test("parseLatLonToOsrm tolerates whitespace", () => {
  assert.equal(parseLatLonToOsrm("  48.2082 , 16.3738  "), "16.3738,48.2082");
});

test("parseLatLonToOsrm handles negative coordinates", () => {
  assert.equal(parseLatLonToOsrm("-33.8688,151.2093"), "151.2093,-33.8688");
});

test("parseLatLonToOsrm returns null for non-coordinate strings", () => {
  assert.equal(parseLatLonToOsrm("Stephansdom, Wien"), null);
  assert.equal(parseLatLonToOsrm(""), null);
  assert.equal(parseLatLonToOsrm("48.2082"), null);
});

test("humanDuration formats sub-hour as Nm", () => {
  assert.equal(humanDuration(0), "0m");
  assert.equal(humanDuration(59), "0m"); // 59s rounds to 0m
  assert.equal(humanDuration(60), "1m");
  assert.equal(humanDuration(1525), "25m");
});

test("humanDuration formats >=1h as Hh Mm", () => {
  assert.equal(humanDuration(3600), "1h 0m");
  assert.equal(humanDuration(3660), "1h 1m");
  assert.equal(humanDuration(11820), "3h 17m");
});

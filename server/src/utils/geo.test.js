import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDropoffLocation, haversineMeters } from "./geo.js";

const CONFIG = {
  radiusMeters: 150,
  maxAccuracyMeters: 100,
  maxAgeMs: 120000,
  maxFutureSkewMs: 60000,
  mode: "enforce",
};

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const fresh = new Date(NOW).toISOString();
const dropoff = { lat: 6.8, lng: 3.45 };

test("haversine returns zero for the same point", () => {
  assert.equal(haversineMeters(6.8, 3.45, 6.8, 3.45), 0);
});

test("haversine is about 111 km per degree of latitude", () => {
  const d = haversineMeters(6.8, 3.45, 7.8, 3.45);
  assert.ok(d > 111000 && d < 111500, `unexpected distance ${d}`);
});

test("accepts a fresh, accurate reading inside the radius", () => {
  const result = evaluateDropoffLocation({
    dropoff,
    input: { lat: 6.8, lng: 3.45, accuracy: 10, capturedAt: fresh },
    config: CONFIG,
    now: NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.distanceMeters, 0);
});

test("hard-blocks a reading outside the radius", () => {
  const result = evaluateDropoffLocation({
    dropoff,
    input: { lat: 7.0, lng: 3.45, accuracy: 10, capturedAt: fresh },
    config: CONFIG,
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "LOCATION_TOO_FAR");
  assert.equal(result.requiresReason, false);
});

test("requires a reason when the drop-off has no coordinates", () => {
  const result = evaluateDropoffLocation({
    dropoff: null,
    input: { lat: 6.8, lng: 3.45, accuracy: 10, capturedAt: fresh },
    config: CONFIG,
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "LOCATION_UNAVAILABLE");
  assert.equal(result.requiresReason, true);
});

test("requires a reason when the rider location is missing", () => {
  const result = evaluateDropoffLocation({
    dropoff,
    input: {},
    config: CONFIG,
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "LOCATION_MISSING");
  assert.equal(result.requiresReason, true);
});

test("requires a reason when the reading is stale", () => {
  const result = evaluateDropoffLocation({
    dropoff,
    input: {
      lat: 6.8,
      lng: 3.45,
      accuracy: 10,
      capturedAt: new Date(NOW - 130000).toISOString(),
    },
    config: CONFIG,
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "LOCATION_STALE");
  assert.equal(result.requiresReason, true);
});

test("requires a reason when accuracy is too low", () => {
  const result = evaluateDropoffLocation({
    dropoff,
    input: { lat: 6.8, lng: 3.45, accuracy: 200, capturedAt: fresh },
    config: CONFIG,
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "LOCATION_INACCURATE");
  assert.equal(result.requiresReason, true);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProximityAudit,
  decideProximityAction,
  evaluateDropoffLocation,
  getProximityConfig,
  haversineMeters,
} from "./geo.js";

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

test("requires a reason when accuracy is missing", () => {
  const result = evaluateDropoffLocation({
    dropoff,
    input: { lat: 6.8, lng: 3.45, capturedAt: fresh },
    config: CONFIG,
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "LOCATION_INACCURATE");
  assert.equal(result.requiresReason, true);
});

test("requires a reason when capturedAt is missing", () => {
  const result = evaluateDropoffLocation({
    dropoff,
    input: { lat: 6.8, lng: 3.45, accuracy: 10 },
    config: CONFIG,
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "LOCATION_STALE");
  assert.equal(result.requiresReason, true);
});

test("decideProximityAction covers allow, reject, reason, warn and off", () => {
  assert.equal(
    decideProximityAction({
      evaluation: { ok: true },
      reason: "",
      mode: "enforce",
    }).action,
    "allow"
  );
  assert.equal(
    decideProximityAction({
      evaluation: { ok: false, requiresReason: false },
      reason: "anything",
      mode: "enforce",
    }).action,
    "reject"
  );
  assert.equal(
    decideProximityAction({
      evaluation: { ok: false, requiresReason: true },
      reason: "   ",
      mode: "enforce",
    }).action,
    "needReason"
  );
  assert.equal(
    decideProximityAction({
      evaluation: { ok: false, requiresReason: true },
      reason: "GPS unavailable",
      mode: "enforce",
    }).action,
    "allowWithReason"
  );
  assert.equal(
    decideProximityAction({
      evaluation: { ok: false, requiresReason: false },
      reason: "",
      mode: "warn",
    }).action,
    "warn"
  );
  assert.equal(
    decideProximityAction({
      evaluation: { ok: false, requiresReason: false },
      reason: "",
      mode: "off",
    }).action,
    "skip"
  );
});

test("buildProximityAudit writes CLOSE_BY fields only", () => {
  const audit = buildProximityAudit({
    status: "CLOSE_BY",
    evaluation: { ok: true, distanceMeters: 12 },
    input: { lat: 6.8, lng: 3.45, accuracy: 10, capturedAt: fresh },
    reason: "",
    now: new Date(NOW),
  });

  assert.equal(audit.closeByLat, 6.8);
  assert.equal(audit.closeByLng, 3.45);
  assert.equal(audit.closeByAccuracy, 10);
  assert.equal(audit.closeByVerified, true);
  assert.equal(audit.closeByDistanceMeters, 12);
  assert.equal(audit.closeByCapturedAt.toISOString(), fresh);
  assert.equal(audit.closeByAt.getTime(), NOW);
  assert.equal(audit.closeByUnverifiedReason, null);
  assert.equal(audit.deliveredLat, undefined);
});

test("buildProximityAudit writes DELIVERED fields only, including reason", () => {
  const audit = buildProximityAudit({
    status: "DELIVERED",
    evaluation: { ok: false, requiresReason: true, message: "No location" },
    input: { lat: null, lng: null, accuracy: null, capturedAt: null },
    reason: "GPS unavailable in hostel",
    now: new Date(NOW),
  });

  assert.equal(audit.deliveredVerified, false);
  assert.equal(audit.deliveredUnverifiedReason, "GPS unavailable in hostel");
  assert.equal(audit.deliveredDistanceMeters, null);
  assert.equal(audit.closeByLat, undefined);
  assert.equal(audit.closeByAt, undefined);
});

test("getProximityConfig accepts the documented env names and defaults", () => {
  const before = {
    radius: process.env.DELIVERY_RADIUS_METERS,
    accuracy: process.env.DELIVERY_LOCATION_MAX_ACCURACY_METERS,
    age: process.env.DELIVERY_LOCATION_MAX_AGE_MS,
  };

  try {
    process.env.DELIVERY_RADIUS_METERS = "200";
    process.env.DELIVERY_LOCATION_MAX_ACCURACY_METERS = "80";
    process.env.DELIVERY_LOCATION_MAX_AGE_MS = "90000";
    const config = getProximityConfig();
    assert.equal(config.radiusMeters, 200);
    assert.equal(config.maxAccuracyMeters, 80);
    assert.equal(config.maxAgeMs, 90000);
  } finally {
    for (const [key, value] of Object.entries({
      DELIVERY_RADIUS_METERS: before.radius,
      DELIVERY_LOCATION_MAX_ACCURACY_METERS: before.accuracy,
      DELIVERY_LOCATION_MAX_AGE_MS: before.age,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

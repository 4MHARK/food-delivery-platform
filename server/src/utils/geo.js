const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

const positiveNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function getProximityConfig() {
  const mode = process.env.DELIVERY_PROXIMITY_ENFORCEMENT || "enforce";
  return {
    radiusMeters: positiveNumber(process.env.DELIVERY_PROXIMITY_RADIUS_METERS, 150),
    maxAccuracyMeters: positiveNumber(process.env.DELIVERY_MAX_ACCURACY_METERS, 100),
    maxAgeMs:
      positiveNumber(process.env.DELIVERY_LOCATION_MAX_AGE_SECONDS, 120) * 1000,
    maxFutureSkewMs:
      positiveNumber(process.env.DELIVERY_CLOCK_SKEW_SECONDS, 60) * 1000,
    mode: ["enforce", "warn", "off"].includes(mode) ? mode : "enforce",
  };
}

// Pure evaluator so it can be reasoned about (and tested) without Express/DB.
// A clear far-away reading is a hard stop (`requiresReason: false`). Missing or
// unreliable GPS is allowed with a reason, because a dead GPS must not strand a
// rider; the flag is the audit trail.
export function evaluateDropoffLocation({
  dropoff,
  input = {},
  config,
  now = Date.now(),
}) {
  if (!dropoff || dropoff.lat == null || dropoff.lng == null) {
    return {
      ok: false,
      code: "LOCATION_UNAVAILABLE",
      requiresReason: true,
      message:
        "This order has no map pin for the drop-off. Add a short reason to confirm the delivery.",
    };
  }

  if (input.lat == null || input.lng == null) {
    return {
      ok: false,
      code: "LOCATION_MISSING",
      requiresReason: true,
      message:
        "We couldn't get your current location. Add a short reason to confirm the delivery.",
    };
  }

  const capturedAt = input.capturedAt
    ? new Date(input.capturedAt).getTime()
    : null;

  if (!Number.isFinite(capturedAt)) {
    return {
      ok: false,
      code: "LOCATION_STALE",
      requiresReason: true,
      message:
        "We couldn't verify how fresh your location is. Add a short reason to confirm the delivery.",
    };
  }

  if (
    capturedAt - now > config.maxFutureSkewMs ||
    now - capturedAt > config.maxAgeMs
  ) {
    return {
      ok: false,
      code: "LOCATION_STALE",
      requiresReason: true,
      message:
        "Your location reading is out of date. Try again, or add a short reason to confirm the delivery.",
    };
  }

  if (
    input.accuracy == null ||
    !Number.isFinite(Number(input.accuracy)) ||
    Number(input.accuracy) > config.maxAccuracyMeters
  ) {
    return {
      ok: false,
      code: "LOCATION_INACCURATE",
      requiresReason: true,
      accuracyMeters: input.accuracy ?? null,
      message:
        "Your GPS accuracy is too low to verify the handoff. Add a short reason to confirm the delivery.",
    };
  }

  const distance = haversineMeters(
    dropoff.lat,
    dropoff.lng,
    input.lat,
    input.lng
  );
  const roundedDistance = Math.round(distance);

  if (distance > config.radiusMeters) {
    return {
      ok: false,
      code: "LOCATION_TOO_FAR",
      requiresReason: false,
      distanceMeters: roundedDistance,
      radiusMeters: config.radiusMeters,
      accuracyMeters: Number(input.accuracy),
      message: `You appear to be ${roundedDistance} m from the drop-off point (limit ${config.radiusMeters} m).`,
    };
  }

  return {
    ok: true,
    distanceMeters: roundedDistance,
    radiusMeters: config.radiusMeters,
    accuracyMeters: Number(input.accuracy),
  };
}

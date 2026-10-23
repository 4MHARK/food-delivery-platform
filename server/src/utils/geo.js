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

const firstPositive = (values) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
};

export function getProximityConfig() {
  const mode = process.env.DELIVERY_PROXIMITY_ENFORCEMENT || "enforce";
  const maxAgeMs =
    firstPositive([process.env.DELIVERY_LOCATION_MAX_AGE_MS]) ??
    (firstPositive([process.env.DELIVERY_LOCATION_MAX_AGE_SECONDS]) ?? 120) *
      1000;

  return {
    radiusMeters:
      firstPositive([
        process.env.DELIVERY_RADIUS_METERS,
        process.env.DELIVERY_PROXIMITY_RADIUS_METERS,
      ]) ?? 150,
    maxAccuracyMeters:
      firstPositive([
        process.env.DELIVERY_LOCATION_MAX_ACCURACY_METERS,
        process.env.DELIVERY_MAX_ACCURACY_METERS,
      ]) ?? 100,
    maxAgeMs,
    maxFutureSkewMs:
      (firstPositive([process.env.DELIVERY_CLOCK_SKEW_SECONDS]) ?? 60) * 1000,
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

// Decide what the route should do with an evaluation. Pure so the
// enforce/warn/off and reason-required branches can be unit-tested.
export function decideProximityAction({ evaluation, reason, mode = "enforce" }) {
  if (mode === "off") return { action: "skip" };
  if (evaluation.ok) return { action: "allow" };
  if (mode === "warn") return { action: "warn" };
  if (!evaluation.requiresReason) return { action: "reject" };
  if (!reason || !String(reason).trim()) return { action: "needReason" };
  return { action: "allowWithReason" };
}

// Per-event audit fields. CLOSE_BY and DELIVERED must never overwrite each
// other's reason/distance, so both events have their own columns.
export function buildProximityAudit({
  status,
  evaluation,
  input = {},
  reason,
  now = new Date(),
}) {
  if (status !== "CLOSE_BY" && status !== "DELIVERED") return {};

  const prefix = status === "CLOSE_BY" ? "closeBy" : "delivered";
  const verified = evaluation?.ok === true;
  const capturedDate = input.capturedAt
    ? new Date(input.capturedAt)
    : null;
  const capturedAt =
    capturedDate && !Number.isNaN(capturedDate.getTime()) ? capturedDate : null;

  const audit = {
    [`${prefix}Lat`]: input.lat ?? null,
    [`${prefix}Lng`]: input.lng ?? null,
    [`${prefix}Accuracy`]: input.accuracy ?? null,
    [`${prefix}CapturedAt`]: capturedAt,
    [`${prefix}Verified`]: verified,
    [`${prefix}DistanceMeters`]: evaluation?.distanceMeters ?? null,
    [`${prefix}UnverifiedReason`]: verified
      ? null
      : reason || evaluation?.message || null,
  };

  if (status === "CLOSE_BY") audit.closeByAt = now;
  return audit;
}

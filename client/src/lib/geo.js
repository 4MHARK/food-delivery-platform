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

export class GeoError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GeoError";
    this.code = code;
  }
}

const GEO_MESSAGES = {
  PERMISSION_DENIED:
    "Location permission was denied. Enable it in your browser settings, or type the drop-off details below.",
  POSITION_UNAVAILABLE:
    "Your location is unavailable right now. Try again, or type the drop-off details below.",
  TIMEOUT:
    "Getting your location took too long. Try again, or type the drop-off details below.",
  UNSUPPORTED:
    "This browser doesn't support location. Choose a landmark from the list instead.",
};

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new GeoError("UNSUPPORTED", GEO_MESSAGES.UNSUPPORTED));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
      },
      (error) => {
        const code =
          error?.code === 1
            ? "PERMISSION_DENIED"
            : error?.code === 3
              ? "TIMEOUT"
              : "POSITION_UNAVAILABLE";
        reject(new GeoError(code, GEO_MESSAGES[code]));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

// Pick the closest campus landmark to a position. Landmarks without
// coordinates are ignored; callers can still list them for manual selection.
export function nearestLandmark(
  position,
  landmarks,
  { maxDistanceMeters = 300 } = {}
) {
  if (!position) return null;

  let best = null;
  for (const landmark of landmarks || []) {
    if (landmark.lat == null || landmark.lng == null) continue;
    const distanceMeters = haversineMeters(
      position.lat,
      position.lng,
      landmark.lat,
      landmark.lng
    );
    if (!best || distanceMeters < best.distanceMeters) {
      best = { landmark, distanceMeters };
    }
  }

  if (!best || best.distanceMeters > maxDistanceMeters) return null;
  return { ...best, distanceMeters: Math.round(best.distanceMeters) };
}

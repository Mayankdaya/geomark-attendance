/* ==========================================================================
   GEO-UTILITIES — js/distance.js
   --------------------------------------------------------------------------
   Everything location-related lives here so both dashboards share one
   consistent, testable implementation:

     1. haversineDistance()  — great-circle distance between two coordinates
     2. getGPSPosition()     — Promise wrapper around the Browser
                               Geolocation API (getCurrentPosition)
     3. gpsErrorMessage()    — human-friendly copy for GPS failures
   ========================================================================== */

/* ANTI-PROXY RULE:
   A GPS fix whose reported accuracy is WORSE (i.e. a number larger) than
   this many metres is rejected outright. Spoofed / weak indoor signals
   usually report 40–2000 m accuracy, so this gate filters most fakes. */
export const MAX_ALLOWED_ACCURACY = 20; // metres

/**
 * HAVERSINE FORMULA
 * -----------------
 * Returns the distance in METRES between two points on Earth given as
 * decimal degrees: (lat1, lon1) and (lat2, lon2).
 *
 * The formula computes the great-circle distance on a sphere:
 *
 *   a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)
 *   c = 2 · atan2(√a, √(1−a))
 *   d = R · c
 *
 * where φ = latitude, λ = longitude (in radians) and R is the mean
 * Earth radius (6,371,000 m). Accuracy is within ~0.5% of the true
 * ellipsoidal distance, which is more than enough for a 30 m geofence.
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const EARTH_RADIUS_M = 6371000;          // mean Earth radius in metres
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);         // Δφ
  const dLon = toRad(lon2 - lon1);         // Δλ

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;               // straight-line distance (m)
}

/**
 * Wraps navigator.geolocation.getCurrentPosition in a Promise (the raw
 * API is callback-based, which is awkward with async/await).
 *
 * Defaults are tuned for reliability:
 *   enableHighAccuracy: true -> prefer GPS over coarse network location
 *   timeout: 15 s            -> give the device time to lock on
 *   maximumAge: 0            -> NEVER accept a cached (possibly stale,
 *                               easily replayed) position — anti-proxy
 */
export function getGPSPosition(options = {}) {
  const settings = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    ...options
  };

  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser does not support Geolocation."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, settings);
  });
}

/** Translate a GeolocationPositionError into readable feedback text. */
export function gpsErrorMessage(error) {
  if (!error) return "Unknown location error.";
  switch (error.code) {
    case 1: return "Location permission denied. Allow location access for this site and try again.";
    case 2: return "Location unavailable. Make sure GPS / location services are turned on.";
    case 3: return "Getting a GPS fix timed out. Move to an open area and try again.";
    default: return error.message || "Unknown location error.";
  }
}

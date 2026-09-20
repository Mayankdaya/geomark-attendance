// ─────────────────────────────────────────────────────────────
// Geospatial helpers — shared by client UI and server API.
// ─────────────────────────────────────────────────────────────

export const EARTH_RADIUS_M = 6_371_000; // mean Earth radius in meters

/**
 * Haversine formula — great-circle distance between two GPS points.
 * Returns distance in METERS.
 *
 *   a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
 *   c = 2 ⋅ atan2( √a, √(1−a) )
 *   d = R ⋅ c
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * Offset a GPS point by a distance in meters.
 * bearing 0 = north, 90 = east. Used ONLY by demo GPS simulation
 * so testers can try "inside geofence" vs "45 m away" without walking.
 */
export function offsetPoint(
  lat: number,
  lng: number,
  meters: number,
  bearingDeg = 45,
): { lat: number; lng: number } {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const δ = meters / EARTH_RADIUS_M; // angular distance
  const θ = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );

  return { lat: (φ2 * 180) / Math.PI, lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180 };
}

/** Human-friendly distance label: "12 m" / "1.2 km" */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** Plausible simulated GPS fix at ~`meters` from the classroom (demo simulator). */
export function simulateGpsFix(
  lat: number,
  lng: number,
  meters: number,
): { lat: number; lng: number; accuracy: number } {
  const p = offsetPoint(lat, lng, meters, Math.random() * 360);
  return { lat: p.lat, lng: p.lng, accuracy: 4 + Math.random() * 9 };
}

// ── System thresholds (single source of truth) ──
export const ATTENDANCE_RADIUS_M = 30; // geofence: must be within 30 m
export const MAX_ACCURACY_M = 20; // reject GPS fixes less precise than 20 m
export const SESSION_DURATION_MIN = 10; // session auto-expires after 10 min
export const LOW_ATTENDANCE_THRESHOLD = 75; // % below which students are flagged

// Client-side fetch + geolocation helpers

export async function api<T>(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; data: T }> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...init,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data: data as T };
}

export function post<T>(url: string, body?: unknown) {
  return api<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined });
}

export function patch<T>(url: string, body?: unknown) {
  return api<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
}

/** Browser GPS — wrapped promise with high accuracy + friendly error mapping. */
export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser does not support GPS location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        const messages: Record<number, string> = {
          1: "Location permission denied. Allow location access in your browser settings, or use the Demo GPS simulator.",
          2: "Location unavailable right now. Try moving slightly and retry.",
          3: "GPS timed out. Retry, or use the Demo GPS simulator.",
        };
        reject(new Error(messages[err.code] ?? "Could not read your location."));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
    );
  });
}

/** mm:ss countdown from an ISO end time */
export function formatCountdown(endTimeISO: string, now: number): string {
  const ms = new Date(endTimeISO).getTime() - now;
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

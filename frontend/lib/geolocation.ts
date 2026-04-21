import type { LatLng } from "./maps";

/**
 * Permission state we model in the UI.
 * - "unsupported" — `navigator.geolocation` is missing (ancient browser / sandbox).
 * - "prompt"      — we haven't asked this session yet, OS will show a dialog.
 * - "granted"     — already allowed; we can start watching immediately.
 * - "denied"      — user or OS has blocked us; retrying will silently fail.
 * - "unknown"     — Permissions API not available (Safari <16). Treat like prompt.
 */
export type GeoPermissionState =
  | "unsupported"
  | "prompt"
  | "granted"
  | "denied"
  | "unknown";

/**
 * Read the current geolocation permission without actually requesting it.
 * Safe to call on mount so we can render the right CTA copy up front
 * ("Share live" vs "Enable location in your browser settings…").
 *
 * Uses the Permissions API where available, which is every modern browser
 * except Safari <16. Falls back to "unknown" otherwise.
 */
export async function readGeoPermission(): Promise<GeoPermissionState> {
  if (typeof navigator === "undefined") return "unsupported";
  if (!("geolocation" in navigator)) return "unsupported";
  const perms = (navigator as Navigator & {
    permissions?: {
      query: (d: { name: PermissionName }) => Promise<PermissionStatus>;
    };
  }).permissions;
  if (!perms?.query) return "unknown";
  try {
    const status = await perms.query({ name: "geolocation" as PermissionName });
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Thin, promise-based wrapper around `navigator.geolocation.getCurrentPosition`.
 *
 * Browsers only hand out the geolocation prompt on a secure context from a
 * user gesture, so this should always be called from a click handler (e.g.
 * "Use my current location"). Rejection reasons are kept short and user-
 * readable so the UI can surface them verbatim.
 */
export function getCurrentLocation(
  options?: PositionOptions,
): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable it in your browser settings to auto-fill your spot."
            : err.code === err.POSITION_UNAVAILABLE
            ? "Couldn't determine your location. Try again or drop the pin manually."
            : err.code === err.TIMEOUT
            ? "Location request timed out. Try again."
            : err.message || "Couldn't get your location";
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
        ...options,
      },
    );
  });
}

/**
 * A single position update. Includes accuracy (metres, 1-sigma) so the UI
 * can surface "±8m" precision to friends watching you broadcast — a
 * tangible trust signal that this is a real GPS fix, not a cached guess.
 */
export interface GeoFix extends LatLng {
  /** Radius of 68% confidence circle in metres, per the Geolocation API. */
  accuracyM: number;
  /** Epoch ms when the fix was taken. */
  at: number;
}

/**
 * Live-watch the user's position. Returns an unsubscribe function.
 * Used inside the picker so the blue "you are here" dot keeps updating,
 * and by the live presence map so peers see you move in real time.
 */
export function watchLocation(
  onUpdate: (fix: GeoFix) => void,
  onError?: (err: Error) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError?.(new Error("Location is not supported on this device"));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy,
        at: pos.timestamp || Date.now(),
      }),
    (err) => onError?.(new Error(err.message || "Location error")),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

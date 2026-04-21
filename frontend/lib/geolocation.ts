import type { LatLng } from "./maps";

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
 * Live-watch the user's position. Returns an unsubscribe function.
 * Used inside the picker so the blue "you are here" dot keeps updating.
 */
export function watchLocation(
  onUpdate: (pos: LatLng) => void,
  onError?: (err: Error) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError?.(new Error("Location is not supported on this device"));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => onError?.(new Error(err.message || "Location error")),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

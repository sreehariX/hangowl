/**
 * Free Google Maps deep-linking.
 *
 * Uses the `google.com/maps/dir/` universal URL scheme (no API key, no billing).
 * On iOS/Android this opens the native Google Maps app; on desktop it opens
 * maps.google.com in a new tab. This is the same pattern used by Uber, Airbnb,
 * etc. to hand off navigation without paying for the Directions API.
 *
 * For known IIT Bombay campus landmarks we ship approximate lat/lng so the
 * destination pin lands on the right building instead of relying on fuzzy
 * text search. Unknown locations fall through to a text query.
 */

type LatLng = { lat: number; lng: number };

/**
 * Approximate campus coordinates for IIT Bombay, Powai. These are "good
 * enough to route to the right building" — not survey-grade. Coordinates
 * are tuned to drop the pin at the hostel/landmark entrance so the
 * door-to-door ETA in Google Maps is reasonable.
 */
const IITB_CAMPUS_PINS: Record<string, LatLng> = {
  H1: { lat: 19.1353, lng: 72.9170 },
  H2: { lat: 19.1338, lng: 72.9153 },
  H3: { lat: 19.1333, lng: 72.9145 },
  H4: { lat: 19.1327, lng: 72.9139 },
  H5: { lat: 19.1321, lng: 72.9132 },
  H6: { lat: 19.1316, lng: 72.9125 },
  H7: { lat: 19.1308, lng: 72.9120 },
  H8: { lat: 19.1300, lng: 72.9126 },
  H9: { lat: 19.1292, lng: 72.9132 },
  H10: { lat: 19.1286, lng: 72.9139 },
  H11: { lat: 19.1280, lng: 72.9146 },
  H12: { lat: 19.1346, lng: 72.9161 },
  H13: { lat: 19.1358, lng: 72.9179 },
  H14: { lat: 19.1363, lng: 72.9188 },
  H15: { lat: 19.1368, lng: 72.9197 },
  H16: { lat: 19.1374, lng: 72.9206 },
  H17: { lat: 19.1380, lng: 72.9215 },
  H18: { lat: 19.1386, lng: 72.9224 },
  H19: { lat: 19.1392, lng: 72.9233 },
  "Academic Area": { lat: 19.1334, lng: 72.9133 },
  Gymkhana: { lat: 19.1308, lng: 72.9141 },
};

const CAMPUS_QUERY_SUFFIX = "IIT Bombay, Powai, Mumbai";

function normalizeKey(loc: string): string {
  return loc.trim();
}

/**
 * Build a free Google Maps directions URL that navigates the user from their
 * current location to the given destination.
 *
 * Priority:
 *   1. Explicit `coords` (creator pinned the exact spot when making the plan)
 *   2. Campus landmark lookup from the label (e.g. "H7" -> known hostel pin)
 *   3. Text query scoped to campus
 */
export function buildDirectionsUrl(
  location: string,
  coords?: LatLng | null,
): string {
  const base = "https://www.google.com/maps/dir/?api=1&travelmode=walking";

  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    const dest = `${coords.lat},${coords.lng}`;
    return `${base}&destination=${encodeURIComponent(dest)}`;
  }

  const key = normalizeKey(location);
  const pin = IITB_CAMPUS_PINS[key];
  if (pin) {
    const dest = `${pin.lat},${pin.lng}`;
    return `${base}&destination=${encodeURIComponent(dest)}`;
  }

  // Fall back to a text query. Scope to campus so Google Maps doesn't send
  // the user to a hostel in a different city.
  const query = `${key}, ${CAMPUS_QUERY_SUFFIX}`;
  return `${base}&destination=${encodeURIComponent(query)}`;
}

/**
 * Open Google Maps directions in a new tab / the native app.
 *
 * We use `window.open(..., "_blank")` so iOS Safari hands off to the Google
 * Maps or Apple Maps app (via universal links) instead of navigating away
 * from HangOwl.
 */
export function openDirections(
  location: string,
  coords?: LatLng | null,
): void {
  if (typeof window === "undefined") return;
  const url = buildDirectionsUrl(location, coords);
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Default map center when we don't yet have a user location (bang in the
 * middle of IIT Bombay campus).
 */
export const CAMPUS_CENTER: LatLng = { lat: 19.1334, lng: 72.9133 };
export type { LatLng };

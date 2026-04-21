"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, TileLayer } from "leaflet";
// Import Leaflet's stylesheet from the npm package. Bundled, deterministic,
// and available before `L.map(...)` runs — unlike the CDN @import we used
// to rely on, which caused every tile except the centre one to render at
// 100% container width (Tailwind's image reset was winning).
import "leaflet/dist/leaflet.css";
import { CAMPUS_CENTER, type LatLng } from "@/lib/maps";
import { getCurrentLocation } from "@/lib/geolocation";
import { CloseIcon, NavigationIcon } from "@/components/icons";
import { Spinner } from "@/components/primitives";

interface LocationPickerProps {
  /** Initial coords if the user has already picked a spot earlier. */
  initial?: LatLng | null;
  /** Optional label hint shown in the header ("Pin H7 exactly"). */
  label?: string;
  onCancel: () => void;
  onConfirm: (coords: LatLng) => void;
}

/**
 * Wait for a DOM node to actually have non-zero dimensions. Leaflet measures
 * its container at construction time — if we call `L.map(container)` while
 * the modal's fade-in is still animating, the container is 0×0 and Leaflet
 * only ever requests the single tile at the centre. Everything else stays
 * blank. This helper blocks until layout has committed real width/height.
 */
function waitForDimensions(el: HTMLElement, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      ro?.disconnect();
      window.clearTimeout(timeout);
      resolve();
    };
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (el.clientWidth > 0 && el.clientHeight > 0) finish();
          })
        : null;
    ro?.observe(el);
    const timeout = window.setTimeout(finish, timeoutMs);
  });
}

/**
 * Full-screen "drop the pin" picker.
 *
 * UX pattern: **fixed centre pin, draggable map** (iOS Maps / Uber / Airbnb /
 * Google Maps place picker). This beats a draggable marker on small screens
 * because:
 *   - the user's finger never covers the target,
 *   - the pin is always dead-centre so it's easy to spot,
 *   - the whole gesture is one-handed,
 *   - precise adjustments just mean smaller pans.
 *
 * Tiles: CartoDB **Voyager** (colourful, high-contrast, Google-Maps-like).
 * Falls back to standard OSM raster if Voyager subdomains fail. Both are
 * free, no API key, attributed to OSM.
 */
export function LocationPicker({
  initial,
  label,
  onCancel,
  onConfirm,
}: LocationPickerProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<LatLng>(initial ?? CAMPUS_CENTER);
  const [locating, setLocating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const moveTo = useCallback((pos: LatLng, zoom?: number) => {
    setCoords(pos);
    if (mapRef.current) {
      mapRef.current.setView(
        [pos.lat, pos.lng],
        zoom ?? mapRef.current.getZoom(),
        { animate: true },
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      const L = (await import("leaflet")).default;
      const container = containerRef.current;
      if (cancelled || !container) return;

      // Block until the container has real dimensions. Until then, Leaflet
      // thinks the viewport is 0×0 and only paints one tile.
      await waitForDimensions(container);
      if (cancelled) return;

      const start = initial ?? CAMPUS_CENTER;
      const map = L.map(container, {
        center: [start.lat, start.lng],
        zoom: initial ? 18 : 16,
        zoomControl: false,
        attributionControl: true,
        inertia: true,
        worldCopyJump: false,
        preferCanvas: false,
      });
      mapRef.current = map;

      // Primary: CartoDB Voyager — colourful, high-contrast, reads like
      // Google Maps. Retina suffix {r} serves @2x on high-DPI phones.
      const voyager = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 20,
          subdomains: "abcd",
          crossOrigin: true,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      ) as TileLayer;
      voyager.addTo(map);

      // Fallback: if Voyager tiles repeatedly fail to load (blocked CDN,
      // flaky ISP), swap to the canonical OSM tile server. We only switch
      // once, and only if the first couple of attempts error out — so the
      // user never sees a black map waiting for an already-dead CDN.
      let tileErrors = 0;
      let swapped = false;
      voyager.on("tileerror", () => {
        tileErrors += 1;
        if (!swapped && tileErrors >= 3) {
          swapped = true;
          voyager.remove();
          L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            crossOrigin: true,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          }).addTo(map);
        }
      });

      // Track the centre as the map pans. This is the whole picker.
      const syncFromCentre = () => {
        const c = map.getCenter();
        setCoords({ lat: c.lat, lng: c.lng });
      };
      map.on("move", syncFromCentre);
      map.on("movestart", () => setDragging(true));
      map.on("moveend", () => setDragging(false));

      // Belt + braces size invalidation. Even though we already waited for
      // real dimensions, mobile browsers collapse their URL bar on scroll,
      // the software keyboard resizes the viewport, and iOS Safari lies
      // about 100vh. Invalidate on every visible size change.
      const invalidate = () => map.invalidateSize({ animate: false });
      requestAnimationFrame(invalidate);
      const t1 = window.setTimeout(invalidate, 100);
      const t2 = window.setTimeout(invalidate, 400);
      const ro =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => invalidate())
          : null;
      ro?.observe(container);
      window.addEventListener("resize", invalidate);
      window.addEventListener("orientationchange", invalidate);
      cleanups.push(() => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        ro?.disconnect();
        window.removeEventListener("resize", invalidate);
        window.removeEventListener("orientationchange", invalidate);
      });

      // Request location right away when the user has no prior pin.
      if (!initial) {
        setLocating(true);
        try {
          const here = await getCurrentLocation();
          if (!cancelled) {
            map.setView([here.lat, here.lng], 18, { animate: false });
            setCoords(here);
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Couldn't get your location");
          }
        } finally {
          if (!cancelled) setLocating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Mount once per modal open; `initial` is stable for the modal's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUseMyLocation() {
    setError("");
    setLocating(true);
    try {
      const here = await getCurrentLocation();
      moveTo(here, 18);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get your location");
    } finally {
      setLocating(false);
    }
  }

  function handleZoom(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(map.getZoom() + delta);
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-ink-900 animate-fade-in">
      <div className="sticky-bar">
        <button
          type="button"
          onClick={onCancel}
          className="icon-btn"
          aria-label="Close"
        >
          <CloseIcon size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-text-primary">
            Pin the exact spot
          </p>
          {label && (
            <p className="truncate text-caption text-text-tertiary">
              Adjusting {label}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onConfirm(coords)}
          className="btn-primary btn-xs px-4"
        >
          Use this spot
        </button>
      </div>

      <div className="relative flex-1">
        {/* Leaflet needs a sized, non-zero container. The absolute-inset-0
         * div always fills its flex parent, so by the time we mount the
         * map (after `waitForDimensions`) it's guaranteed to have pixels. */}
        <div ref={containerRef} className="absolute inset-0 bg-ink-900" />

        {/* Fixed centre pin. Sits above the tiles and ignores pointer events
         * so the user can always drag the map behind it. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute left-1/2 top-1/2 z-[402] -translate-x-1/2 -translate-y-full transition-transform duration-150 ${
            dragging ? "-translate-y-[calc(100%+8px)]" : ""
          }`}
        >
          <div className="relative flex flex-col items-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber text-ink-950 shadow-[0_10px_24px_rgba(0,0,0,0.55)] ring-4 ring-white/80">
              <NavigationIcon size={18} />
            </div>
            <span className="mt-0.5 h-4 w-[2px] rounded-full bg-amber shadow-[0_6px_10px_rgba(0,0,0,0.55)]" />
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-[401] h-2 w-3 -translate-x-1/2 -translate-y-[2px] rounded-full bg-black/55 blur-[2px]"
        />

        <div className="absolute bottom-32 right-3 z-[403] flex flex-col gap-2">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white/95 text-ink-950 shadow-lg">
            <button
              type="button"
              onClick={() => handleZoom(1)}
              className="flex h-10 w-10 items-center justify-center transition-colors hover:bg-white"
              aria-label="Zoom in"
            >
              <span className="text-lg leading-none">+</span>
            </button>
            <div className="mx-2 h-px bg-ink-950/10" />
            <button
              type="button"
              onClick={() => handleZoom(-1)}
              className="flex h-10 w-10 items-center justify-center transition-colors hover:bg-white"
              aria-label="Zoom out"
            >
              <span className="text-lg leading-none">−</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/95 text-ink-950 shadow-lg transition-colors hover:bg-white disabled:opacity-60"
            aria-label="Use my current location"
          >
            {locating ? <Spinner size={16} /> : <NavigationIcon size={18} />}
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[403] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <div className="pointer-events-auto rounded-2xl border border-border bg-ink-900/92 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur">
            {error && (
              <p className="mb-2 rounded-lg bg-danger/10 px-3 py-2 text-caption text-danger">
                {error}
              </p>
            )}
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber/15 text-amber">
                <NavigationIcon size={12} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-text-secondary">
                  Drag the map to move the pin. The spot under the pin is
                  shared to Google Maps for directions.
                </p>
                <p className="mt-1 font-mono text-[11px] tabular-nums text-text-muted">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

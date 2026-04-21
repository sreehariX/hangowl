"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
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
 * Tiles: CartoDB Dark Matter via the free public CDN (no key, OSM-attributed).
 * It matches the app's midnight palette so the modal no longer looks broken
 * against the black UI.
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

  // Mount Leaflet once. We wait a frame before any sizing so the modal's
  // fade-in animation has committed layout — otherwise Leaflet measures the
  // container at 0×0 and only ever paints the single centre tile (which is
  // exactly the bug reported in the screenshot).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const start = initial ?? CAMPUS_CENTER;
      const map = L.map(containerRef.current, {
        center: [start.lat, start.lng],
        zoom: initial ? 18 : 16,
        zoomControl: false,
        attributionControl: true,
        // Smoother pan for the "drag the map" UX.
        inertia: true,
        worldCopyJump: false,
        preferCanvas: false,
      });
      mapRef.current = map;

      // Dark tile layer. CartoDB Dark Matter is free, no API key, still OSM.
      // Retina suffix ({r}) serves @2x tiles on high-DPI phones.
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 20,
          subdomains: "abcd",
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      ).addTo(map);

      // Track the centre as the map pans. This is the whole picker.
      const syncFromCentre = () => {
        const c = map.getCenter();
        setCoords({ lat: c.lat, lng: c.lng });
      };
      map.on("move", syncFromCentre);
      map.on("movestart", () => setDragging(true));
      map.on("moveend", () => setDragging(false));

      // Force a size recompute after layout commits. Covers:
      //  - the fade-in animation on the modal,
      //  - mobile browser chrome collapsing on scroll,
      //  - iOS Safari 100vh quirks.
      const invalidate = () => map.invalidateSize({ animate: false });
      requestAnimationFrame(invalidate);
      // A second pass after the CSS animation finishes (200ms fade).
      const t = window.setTimeout(invalidate, 250);

      const ro = "ResizeObserver" in window
        ? new ResizeObserver(() => invalidate())
        : null;
      if (ro && containerRef.current) ro.observe(containerRef.current);
      window.addEventListener("resize", invalidate);
      window.addEventListener("orientationchange", invalidate);

      // Stash so we can clean up below without another ref.
      (map as unknown as { __cleanup?: () => void }).__cleanup = () => {
        window.clearTimeout(t);
        ro?.disconnect();
        window.removeEventListener("resize", invalidate);
        window.removeEventListener("orientationchange", invalidate);
      };

      // If we have no initial pin, request location right away (Uber UX).
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
      const m = mapRef.current as unknown as { __cleanup?: () => void } | null;
      m?.__cleanup?.();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Mount once per modal open; `initial` is stable for the lifetime of the modal.
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
        <div ref={containerRef} className="absolute inset-0" />

        {/* Fixed centre pin. Sits above the tiles and ignores pointer events
         * so the user can always drag the map behind it. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute left-1/2 top-1/2 z-[402] -translate-x-1/2 -translate-y-full transition-transform duration-150 ${
            dragging ? "-translate-y-[calc(100%+8px)]" : ""
          }`}
        >
          <div className="relative flex flex-col items-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber text-ink-950 shadow-[0_10px_24px_rgba(0,0,0,0.55)] ring-4 ring-ink-900/70">
              <NavigationIcon size={18} />
            </div>
            {/* Drop-shadow needle connecting pin to its base */}
            <span className="mt-0.5 h-4 w-[2px] rounded-full bg-amber shadow-[0_6px_10px_rgba(0,0,0,0.55)]" />
          </div>
        </div>

        {/* Base shadow at the exact centre — gives the pin a "landing" point
         * that stays put even while the pin bounces on drag. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-[401] h-2 w-3 -translate-x-1/2 -translate-y-[2px] rounded-full bg-black/55 blur-[2px]"
        />

        {/* Zoom + recenter controls. Stacked, iOS-Maps style. */}
        <div className="absolute bottom-32 right-3 z-[403] flex flex-col gap-2">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-ink-900/85 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => handleZoom(1)}
              className="flex h-10 w-10 items-center justify-center text-text-primary transition-colors hover:bg-surface-hover"
              aria-label="Zoom in"
            >
              <span className="text-lg leading-none">+</span>
            </button>
            <div className="mx-2 h-px bg-border" />
            <button
              type="button"
              onClick={() => handleZoom(-1)}
              className="flex h-10 w-10 items-center justify-center text-text-primary transition-colors hover:bg-surface-hover"
              aria-label="Zoom out"
            >
              <span className="text-lg leading-none">−</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-ink-900/90 text-text-primary shadow-lg backdrop-blur transition-colors hover:bg-surface-hover disabled:opacity-60"
            aria-label="Use my current location"
          >
            {locating ? <Spinner size={16} /> : <NavigationIcon size={18} />}
          </button>
        </div>

        {/* Bottom card: hint + lat/lng readout. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[403] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <div className="pointer-events-auto rounded-2xl border border-border bg-ink-900/90 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur">
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker, LeafletEvent, LeafletMouseEvent } from "leaflet";
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
 * Full-screen "drop the pin" picker, Uber-style.
 *
 * - Uses Leaflet + OpenStreetMap tiles (free, no API key, no billing).
 * - Prompts for location permission on open and auto-centres on the user.
 * - Draggable marker + tap-to-move + "recenter on me" control.
 */
export function LocationPicker({
  initial,
  label,
  onCancel,
  onConfirm,
}: LocationPickerProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<LatLng>(initial ?? CAMPUS_CENTER);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  // Centre the map + marker on a given point without creating tile-jitter.
  const moveTo = useCallback((pos: LatLng, zoom?: number) => {
    setCoords(pos);
    if (mapRef.current) {
      mapRef.current.setView([pos.lat, pos.lng], zoom ?? mapRef.current.getZoom());
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([pos.lat, pos.lng]);
    }
  }, []);

  // Initialise Leaflet once the modal is mounted. Dynamic import so it
  // never touches the server bundle.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      // Leaflet's default icon URLs are bundler-hostile. Wire them up
      // manually against the CDN version we already load via globals.css.
      const iconBase = "https://unpkg.com/leaflet@1.9.4/dist/images";
      const icon = L.icon({
        iconUrl: `${iconBase}/marker-icon.png`,
        iconRetinaUrl: `${iconBase}/marker-icon-2x.png`,
        shadowUrl: `${iconBase}/marker-shadow.png`,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const start = initial ?? CAMPUS_CENTER;
      const map = L.map(containerRef.current, {
        center: [start.lat, start.lng],
        zoom: initial ? 18 : 16,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      ).addTo(map);

      const marker = L.marker([start.lat, start.lng], {
        draggable: true,
        icon,
      }).addTo(map);
      markerRef.current = marker;

      marker.on("dragend", (e: LeafletEvent) => {
        const m = e.target as LeafletMarker;
        const { lat, lng } = m.getLatLng();
        setCoords({ lat, lng });
      });
      map.on("click", (e: LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      // If we have no initial pin, request location right away (Uber UX).
      if (!initial) {
        setLocating(true);
        try {
          const here = await getCurrentLocation();
          if (!cancelled) {
            setCoords(here);
            map.setView([here.lat, here.lng], 18);
            marker.setLatLng([here.lat, here.lng]);
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
    // We intentionally mount Leaflet exactly once per open. `moveTo` and
    // `initial` are stable for the lifetime of the modal.
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

        {/* "Recenter on me" fab */}
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="absolute bottom-28 right-4 z-[401] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-ink-900/90 text-text-primary shadow-lg backdrop-blur disabled:opacity-60"
          aria-label="Use my current location"
        >
          {locating ? <Spinner size={16} /> : <NavigationIcon size={18} />}
        </button>

        {/* Bottom readout: lat/lng + hint */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[401] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <div className="pointer-events-auto surface-panel p-3">
            {error && (
              <p className="mb-2 rounded-lg bg-danger/10 px-3 py-2 text-caption text-danger">
                {error}
              </p>
            )}
            <p className="text-caption text-text-tertiary">
              Drag the pin or tap anywhere to adjust. Exact spot helps friends navigate in Google Maps.
            </p>
            <p className="mt-1 font-mono text-[11px] tabular-nums text-text-muted">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

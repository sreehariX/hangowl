"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
  LatLngBounds,
  TileLayer,
} from "leaflet";
// Bundle Leaflet's stylesheet from the package. Importing from a CDN leaves
// a window where tiles render at container width (Tailwind's image reset
// wins), producing the "one tile in a black void" bug.
import "leaflet/dist/leaflet.css";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  readGeoPermission,
  watchLocation,
  type GeoPermissionState,
} from "@/lib/geolocation";
import { CAMPUS_CENTER, openDirections, type LatLng } from "@/lib/maps";
import { NavigationIcon } from "@/components/icons";
import { Spinner } from "@/components/primitives";

interface LivePresenceMapProps {
  planId: string;
  /** The plan creator's user id. Their dot is rendered with a host badge. */
  hostId: string;
  /** Destination pin to keep framed with the crowd. */
  destination?: LatLng | null;
  /** Destination label ("H7", "Sameer Hill Gate"). */
  destinationLabel?: string;
  /**
   * Layout variant.
   *  - "card"  (default): fixed-height card with its own rounded panel + header.
   *  - "fill": fills the parent's height. Used inside PlanDock's full-screen
   *    sheet where the map should own the whole viewport and the header is
   *    rendered by the dock instead.
   */
  variant?: "card" | "fill";
}

/**
 * What each client broadcasts on the presence channel.
 * Coordinates are rounded to 5 decimals (~1 m) before broadcast so a
 * moving user doesn't spam the channel with 14-decimal jitter.
 */
interface Presence {
  userId: string;
  personaName: string;
  /** "host" = hangout creator, "joiner" = everyone else. Same role that Uber
   *  surfaces as driver vs rider — each client picks the right marker style. */
  role: "host" | "joiner";
  lat: number;
  lng: number;
  /** Epoch ms of the last fix; stale dots fade. */
  at: number;
}

const STALE_MS = 60_000;
const FRESH_MS = 10_000;

/**
 * Wait for a DOM node to actually have non-zero pixel dimensions. Leaflet
 * measures its container at construction time; a 0×0 container produces a
 * map that only ever requests the single centre tile.
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
 * Live "Uber-style" map that shows every hangout member moving toward the
 * destination in real time.
 *
 * Design notes:
 *  - Location is strictly opt-in per user, per session (default OFF).
 *  - If permission is denied we fall back to the read-only map: the user
 *    still sees other sharers moving and still has the Directions button
 *    one tap away.
 *  - Host (the plan creator) is rendered with a distinct amber star badge
 *    so everyone knows who's "driving" the hangout. Joiners are blue dots.
 *    You always see yourself highlighted with a thicker ring on top of
 *    either role colour — same visual grammar Uber uses for rider vs
 *    driver without losing "this is me" legibility.
 *
 * Transport: Supabase Realtime Presence. No extra backend, no paid APIs.
 */
export function LivePresenceMap({
  planId,
  hostId,
  destination,
  destinationLabel,
  variant = "card",
}: LivePresenceMapProps) {
  const { userId, personaName, isAuthenticated } = useAuth();
  const isHost = !!userId && userId === hostId;
  const myRole: "host" | "joiner" = isHost ? "host" : "joiner";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const destMarkerRef = useRef<LeafletMarker | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const watchStopRef = useRef<(() => void) | null>(null);
  const lastPushRef = useRef(0);
  const autoFitDoneRef = useRef(false);

  const [permission, setPermission] = useState<GeoPermissionState>("unknown");
  const [sharing, setSharing] = useState(false);
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const [peers, setPeers] = useState<Presence[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  /* ── Check permission state on mount ────────────────────────────────── */

  useEffect(() => {
    let active = true;
    readGeoPermission().then((state) => {
      if (active) setPermission(state);
    });
    return () => {
      active = false;
    };
  }, []);

  /* ── Leaflet bootstrap ──────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const container = containerRef.current;
      if (cancelled || !container) return;

      // Wait for real pixel dimensions so Leaflet never mounts at 0×0.
      await waitForDimensions(container);
      if (cancelled) return;

      const start = destination ?? CAMPUS_CENTER;
      const map = L.map(container, {
        center: [start.lat, start.lng],
        zoom: 17,
        zoomControl: false,
        attributionControl: true,
      });
      // Zoom control in the bottom-right so it never collides with the
      // top status/destination chips. Leaflet's attribution ends up in
      // the bottom-right too, but at a smaller footprint; zoom on top of
      // it reads cleanly once we style both as dark-glass pills.
      L.control.zoom({ position: "bottomright" }).addTo(map);
      // Primary tile layer: CartoDB Voyager — colourful, high-contrast,
      // reads like Google Maps. Free, no API key, OSM-attributed.
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
      // Fallback to canonical OSM if Voyager errors out repeatedly.
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

      if (destination) {
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
        destMarkerRef.current = L.marker([destination.lat, destination.lng], {
          icon,
          interactive: false,
          keyboard: false,
        }).addTo(map);
        if (destinationLabel) {
          destMarkerRef.current.bindTooltip(destinationLabel, {
            permanent: true,
            direction: "top",
            offset: [0, -38],
            className: "presence-tooltip presence-tooltip-dest",
          });
        }
      }

      mapRef.current = map;
      setMapReady(true);

      // Force Leaflet to re-measure once the panel layout settles. Without
      // this, the map can mount at 0×0 (inside the plan page's section
      // transitions / grid columns) and only ever paint the centre tile.
      const invalidate = () => map.invalidateSize({ animate: false });
      requestAnimationFrame(invalidate);
      const t = window.setTimeout(invalidate, 250);
      const ro = "ResizeObserver" in window
        ? new ResizeObserver(() => invalidate())
        : null;
      if (ro && containerRef.current) ro.observe(containerRef.current);
      window.addEventListener("resize", invalidate);
      window.addEventListener("orientationchange", invalidate);
      (map as unknown as { __cleanup?: () => void }).__cleanup = () => {
        window.clearTimeout(t);
        ro?.disconnect();
        window.removeEventListener("resize", invalidate);
        window.removeEventListener("orientationchange", invalidate);
      };
    })();

    const markers = markersRef.current;
    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      const m = mapRef.current as unknown as { __cleanup?: () => void } | null;
      m?.__cleanup?.();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Re-init only when the plan changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  /* ── Subscribe to the presence channel ──────────────────────────────── */

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`plan-presence-${planId}`, {
      config: {
        presence: { key: userId },
        broadcast: { self: false },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Presence>();
        const flat: Presence[] = [];
        for (const key of Object.keys(state)) {
          for (const p of state[key]) {
            if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") {
              continue;
            }
            flat.push(p);
          }
        }
        setPeers(flat);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [planId, userId]);

  /* ── Start / stop sharing my own location ───────────────────────────── */

  const pushPresence = useCallback(
    (pos: LatLng) => {
      const ch = channelRef.current;
      if (!ch || !userId) return;
      const now = Date.now();
      if (now - lastPushRef.current < 1_500) return;
      lastPushRef.current = now;

      const payload: Presence = {
        userId,
        personaName: personaName ?? "Anonymous",
        role: myRole,
        lat: Math.round(pos.lat * 1e5) / 1e5,
        lng: Math.round(pos.lng * 1e5) / 1e5,
        at: now,
      };
      ch.track(payload);
    },
    [userId, personaName, myRole],
  );

  const startSharing = useCallback(() => {
    if (sharing) return;
    if (permission === "unsupported") {
      setError("Location isn't available on this device.");
      return;
    }
    if (permission === "denied") {
      setError(
        "Location is blocked for this site. Enable it in your browser settings, then tap Share live again.",
      );
      return;
    }
    setError(null);
    setSharing(true);
    watchStopRef.current = watchLocation(
      (pos) => {
        setMyPos(pos);
        pushPresence(pos);
        // watchPosition succeeding is the strongest signal that permission
        // was granted — re-read it so the UI flips out of "prompt" copy.
        if (permission !== "granted") setPermission("granted");
      },
      (err) => {
        setError(err.message || "Couldn't get your location");
        setSharing(false);
        // Re-check so the UI can surface the denied state explicitly.
        readGeoPermission().then(setPermission);
      },
    );
  }, [sharing, permission, pushPresence]);

  const stopSharing = useCallback(() => {
    setSharing(false);
    watchStopRef.current?.();
    watchStopRef.current = null;
    setMyPos(null);
    const ch = channelRef.current;
    if (ch) {
      ch.untrack();
    }
  }, []);

  // Cleanup on unmount (user navigated away from the plan page).
  useEffect(() => {
    return () => {
      watchStopRef.current?.();
      watchStopRef.current = null;
    };
  }, []);

  /* ── Render / diff markers ─────────────────────────────────────────── */

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      const seen = new Set<string>();
      const now = Date.now();

      for (const p of peers) {
        const isMe = p.userId === userId;
        if (isMe && !sharing) continue;
        seen.add(p.userId);

        const stale = now - p.at > STALE_MS;
        const fresh = now - p.at < FRESH_MS;
        // A peer may have joined before we shipped the `role` field; treat
        // anyone matching the host id as host regardless of payload shape.
        const isHostDot = p.role === "host" || p.userId === hostId;

        const initial =
          p.personaName
            .split(/\s+/)
            .map((s) => s[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "?";

        const roleClass = isHostDot ? "is-host" : "is-joiner";
        const meClass = isMe ? "is-me" : "";
        const staleClass = stale ? "is-stale" : "";
        const hostBadge = isHostDot
          ? '<span class="presence-host-badge" aria-label="Host">★</span>'
          : "";
        const youTag = isMe
          ? '<span class="presence-you-tag">You</span>'
          : "";
        const hostTag = isHostDot && !isMe
          ? '<span class="presence-host-tag">Host</span>'
          : "";

        const html = `
          <div class="presence-marker ${roleClass} ${meClass} ${staleClass}">
            <div class="presence-bubble">
              ${escapeHtml(p.personaName)}${youTag}${hostTag}
            </div>
            <div class="presence-dot">
              ${fresh && !stale ? '<span class="presence-pulse"></span>' : ""}
              <span class="presence-initials">${escapeHtml(initial)}</span>
              ${hostBadge}
            </div>
          </div>
        `;

        const icon = L.divIcon({
          html,
          className: "presence-divicon",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const existing = markersRef.current.get(p.userId);
        if (existing) {
          existing.setIcon(icon);
          existing.setLatLng([p.lat, p.lng]);
        } else {
          const marker = L.marker([p.lat, p.lng], {
            icon,
            // Stack the host above joiners, and always stack "me" on top.
            zIndexOffset: isMe ? 1500 : isHostDot ? 800 : 0,
            keyboard: false,
          }).addTo(mapRef.current!);
          markersRef.current.set(p.userId, marker);
        }
      }

      for (const [uid, marker] of markersRef.current) {
        if (!seen.has(uid)) {
          marker.remove();
          markersRef.current.delete(uid);
        }
      }

      if (!autoFitDoneRef.current) {
        const pts: [number, number][] = peers.map((p) => [p.lat, p.lng]);
        if (destination) pts.push([destination.lat, destination.lng]);
        if (pts.length >= 2) {
          const bounds = L.latLngBounds(pts) as LatLngBounds;
          mapRef.current!.fitBounds(bounds.pad(0.25), { maxZoom: 18 });
          autoFitDoneRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, mapReady, userId, hostId, sharing, destination]);

  /* ── Derived state for status + CTAs ────────────────────────────────── */

  const othersSharing = useMemo(
    () => peers.filter((p) => p.userId !== userId).length,
    [peers, userId],
  );
  const hostIsSharing = useMemo(
    () => peers.some((p) => p.userId === hostId),
    [peers, hostId],
  );

  const statusLine = (() => {
    if (sharing) {
      return othersSharing > 0
        ? `You + ${othersSharing} sharing live`
        : "Sharing your spot · nobody else is yet";
    }
    if (othersSharing > 0) {
      if (!isHost && hostIsSharing) {
        return `Host is sharing · ${othersSharing} ${othersSharing === 1 ? "person" : "people"} live`;
      }
      return `${othersSharing} ${othersSharing === 1 ? "person" : "people"} sharing live`;
    }
    switch (permission) {
      case "unsupported":
        return "Live map isn't available on this device — use Directions above.";
      case "denied":
        return "Location is blocked — use Directions above, or enable in browser settings.";
      case "granted":
        return isHost
          ? "Share live so people coming to your spot can see you."
          : "Tap Share live so the host can see you approaching.";
      case "prompt":
      default:
        return isHost
          ? "Share live and your guests will see you moving on this map."
          : "Tap Share live — we'll ask for location, then everyone will see you moving.";
    }
  })();

  /* ── Render ─────────────────────────────────────────────────────────── */

  const canShare =
    isAuthenticated &&
    permission !== "unsupported" &&
    permission !== "denied";

  const deniedOrUnsupported =
    permission === "denied" || permission === "unsupported";

  if (variant === "fill") {
    // Full-bleed layout used inside the PlanDock sheet. The map fills the
    // whole viewport; a compact floating status chip sits at the top and
    // the action buttons (Share / Stop / Directions) live in a bottom
    // "action card" similar to Uber's driver sheet / Zepto's tracker.
    return (
      <div className="relative h-full w-full">
        <div ref={containerRef} className="absolute inset-0" />

        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-900/60">
            <Spinner size={18} />
          </div>
        )}

        {/* Top status card. Single full-width pill so nothing truncates
         * and the destination label + live presence state read as one
         * sentence ("H7 · Main Gate — 3 live"). Near-opaque dark surface
         * — Voyager tiles are light, so the usual semi-transparent glass
         * reads muddy; a solid fill with a subtle amber outline keeps
         * the text crisp and unmistakably part of the app chrome. */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[400]">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-amber/30 bg-[rgba(11,11,15,0.96)] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            {destinationLabel && (
              <>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber/15 text-amber">
                  <NavigationIcon size={12} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">
                  {destinationLabel}
                </span>
              </>
            )}
            {!destinationLabel && (
              <span className="text-[13px] font-semibold text-text-primary">
                Live map
              </span>
            )}
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink-800/90 px-2 py-1 text-[11px] font-semibold text-text-secondary">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  sharing
                    ? "bg-success animate-pulse"
                    : othersSharing > 0
                    ? "bg-amber"
                    : "bg-text-muted"
                }`}
              />
              <span>
                {sharing
                  ? othersSharing > 0
                    ? `you + ${othersSharing}`
                    : "sharing"
                  : othersSharing > 0
                  ? `${othersSharing} live`
                  : "offline"}
              </span>
            </span>
          </div>
        </div>

        {sharing && !myPos && (
          <div className="pointer-events-none absolute left-3 top-16 z-[400] rounded-full border border-border bg-[rgba(11,11,15,0.96)] px-3 py-1.5 text-[11px] font-medium text-text-secondary shadow-[0_4px_14px_rgba(0,0,0,0.5)]">
            Getting your location…
          </div>
        )}

        {/* Bottom action card. Two-line layout: first row reads the
         * status in plain English, second row is the action buttons.
         * Solid dark surface (Voyager tiles are light; semi-transparent
         * glass renders muddy over them), amber rim for affordance. */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[400]">
          <div className="pointer-events-auto rounded-2xl border border-border bg-[rgba(11,11,15,0.96)] p-3.5 shadow-[0_-8px_32px_rgba(0,0,0,0.6)]">
            {error && !deniedOrUnsupported && (
              <p className="mb-2 rounded-lg bg-danger/15 px-3 py-2 text-caption text-danger">
                {error}
              </p>
            )}
            {deniedOrUnsupported ? (
              <>
                <p className="text-body font-semibold text-text-primary">
                  {permission === "denied"
                    ? "Location is blocked for this site."
                    : "Live location isn't supported here."}
                </p>
                <p className="mt-0.5 text-[12px] text-text-tertiary">
                  Open directions in Google Maps and navigate like usual.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    openDirections(destinationLabel ?? "", destination ?? null)
                  }
                  className="btn-primary btn-sm mt-2.5 w-full gap-1.5"
                >
                  <NavigationIcon size={14} />
                  Directions in Google Maps
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="presence-legend-dot is-host" />
                    <span className="presence-legend-dot is-joiner" />
                    <span className="presence-legend-dot is-me" />
                  </div>
                  <p className="flex-1 truncate text-[12px] font-medium text-text-secondary">
                    Host · Joined · You
                  </p>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openDirections(destinationLabel ?? "", destination ?? null)
                    }
                    className="btn-secondary btn-sm flex-1 gap-1.5"
                    aria-label="Open directions in Google Maps"
                  >
                    <NavigationIcon size={13} />
                    Directions
                  </button>
                  {isAuthenticated && sharing ? (
                    <button
                      type="button"
                      onClick={stopSharing}
                      className="btn-secondary btn-sm flex-1"
                    >
                      Stop sharing
                    </button>
                  ) : isAuthenticated && canShare ? (
                    <button
                      type="button"
                      onClick={startSharing}
                      className="btn-primary btn-sm flex-1 gap-1.5"
                    >
                      <NavigationIcon size={13} />
                      Share live
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="surface-panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber/15 text-amber">
          <NavigationIcon size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-body font-semibold text-text-primary">
            Live map
            {isHost && (
              <span className="rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber">
                YOU&apos;RE HOSTING
              </span>
            )}
          </h3>
          <p className="text-[11px] text-text-tertiary">{statusLine}</p>
        </div>

        {isAuthenticated &&
          (sharing ? (
            <button
              type="button"
              onClick={stopSharing}
              className="btn-secondary btn-xs"
            >
              Stop
            </button>
          ) : canShare ? (
            <button
              type="button"
              onClick={startSharing}
              className="btn-primary btn-xs"
            >
              Share live
            </button>
          ) : null)}
      </div>

      <div className="relative">
        <div ref={containerRef} className="h-72 w-full" />

        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-900/60">
            <Spinner size={18} />
          </div>
        )}

        {sharing && !myPos && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink-900/85 px-3 py-1.5 text-[11px] text-text-secondary backdrop-blur">
            Getting your location…
          </div>
        )}

        {!sharing && deniedOrUnsupported && (
          <div className="pointer-events-auto absolute inset-x-3 bottom-3 rounded-xl border border-border bg-ink-900/90 p-3 text-caption text-text-secondary backdrop-blur">
            <p className="font-semibold text-text-primary">
              {permission === "denied"
                ? "Location is blocked for this site."
                : "Live location isn't supported on this device."}
            </p>
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              {permission === "denied"
                ? "No worries — open directions in Google Maps and navigate like usual."
                : "Open directions in Google Maps to navigate like usual."}
            </p>
            <button
              type="button"
              onClick={() =>
                openDirections(destinationLabel ?? "", destination ?? null)
              }
              className="btn-secondary btn-xs mt-2 gap-1.5"
            >
              <NavigationIcon size={12} />
              Directions in Google Maps
            </button>
          </div>
        )}

        {error && !deniedOrUnsupported && (
          <div className="pointer-events-auto absolute inset-x-3 bottom-3 rounded-lg bg-danger/15 px-3 py-2 text-caption text-danger">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-[11px] text-text-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <span className="presence-legend-dot is-host" />
          Host
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="presence-legend-dot is-joiner" />
          Joined
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="presence-legend-dot is-me" />
          You
        </span>
      </div>
    </section>
  );
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

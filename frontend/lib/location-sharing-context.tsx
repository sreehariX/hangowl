"use client";

/**
 * App-wide "live location" broadcast.
 *
 * Zepto / Uber / iOS Live Activity behaviour: once the user taps
 * "Share live location" on a plan, broadcasting continues in the
 * background even when they navigate away from /plan/[id] — and
 * resumes automatically after the tab is closed and reopened — until
 * they explicitly tap "Stop sharing".
 *
 * Internals:
 *  - The active target ({ planId, hostId }) is mirrored into
 *    localStorage so a cold tab reload (or PWA relaunch) can rehydrate
 *    the broadcast without the user having to tap again.
 *  - While a target is active we hold exactly one geolocation watch
 *    and one Supabase Presence channel, with the same channel name
 *    (`plan-presence-<planId>`) that LivePresenceMap subscribes to on
 *    the plan page. Both surfaces end up in lock-step.
 *  - If auth flips to false (user signs out) or the target is cleared,
 *    we tear everything down so we never leak a GPS watch.
 *
 * The provider is idempotent: starting a new target tears down any
 * previous one first, so "share live for plan A" -> "share live for
 * plan B" silently handoffs without double-broadcasting.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { watchLocation, type GeoFix } from "@/lib/geolocation";

interface SharingTarget {
  planId: string;
  hostId: string;
}

interface LocationSharingContextValue {
  /** If non-null, we're actively broadcasting to this plan. */
  activePlanId: string | null;
  /** Latest position fix while broadcasting. Null before the first fix. */
  myFix: GeoFix | null;
  /** Latest error surfaced by the geolocation API, if any. */
  error: string | null;
  /** Whether we're broadcasting for the given plan. */
  isSharing: (planId: string) => boolean;
  /** Start sharing for a plan. Replaces any existing broadcast. */
  start: (target: SharingTarget) => void;
  /** Stop sharing. No-op if we weren't sharing. */
  stop: () => void;
}

const STORAGE_KEY = "ho_live_location_target_v1";

const Ctx = createContext<LocationSharingContextValue | null>(null);

function readStoredTarget(): SharingTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SharingTarget;
    if (parsed && parsed.planId && parsed.hostId) return parsed;
  } catch {
    /* corrupt JSON -> treat as not sharing */
  }
  return null;
}

function writeStoredTarget(t: SharingTarget | null) {
  if (typeof window === "undefined") return;
  try {
    if (t) localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage full / private mode — silently tolerate */
  }
}

export function LocationSharingProvider({ children }: { children: ReactNode }) {
  const { userId, personaName, isAuthenticated } = useAuth();

  const [target, setTargetState] = useState<SharingTarget | null>(null);
  const [myFix, setMyFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const stopWatchRef = useRef<(() => void) | null>(null);
  const lastPushRef = useRef(0);

  /* Hydrate from localStorage exactly once, on mount. This has to be
   * a post-mount effect (not `useState` lazy init) so Next.js SSR
   * renders a stable null state before the client rehydrates. */
  useEffect(() => {
    const stored = readStoredTarget();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetState(stored);
    }
  }, []);

  const persistTarget = useCallback((t: SharingTarget | null) => {
    writeStoredTarget(t);
    setTargetState(t);
  }, []);

  /* ── The actual broadcast effect ──────────────────────────────────────
   * Runs whenever the target or auth changes. We tear down any previous
   * watch/channel before starting a new one so there's never more than
   * one active broadcast. */
  useEffect(() => {
    if (!target || !isAuthenticated || !userId) {
      /* No active target — ensure everything is closed. */
      stopWatchRef.current?.();
      stopWatchRef.current = null;
      if (channelRef.current) {
        try {
          channelRef.current.untrack();
        } catch {
          /* channel already torn down */
        }
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMyFix(null);
      lastPushRef.current = 0;
      return;
    }

    const role: "host" | "joiner" =
      userId === target.hostId ? "host" : "joiner";
    const channel = supabase.channel(`plan-presence-${target.planId}`, {
      config: {
        presence: { key: userId },
        broadcast: { self: false },
      },
    });
    channel.subscribe();
    channelRef.current = channel;

    const pushPresence = (fix: GeoFix) => {
      const ch = channelRef.current;
      if (!ch) return;
      const now = Date.now();
      if (now - lastPushRef.current < 1500) return;
      lastPushRef.current = now;
      ch.track({
        userId,
        personaName: personaName ?? "Anonymous",
        role,
        lat: Math.round(fix.lat * 1e5) / 1e5,
        lng: Math.round(fix.lng * 1e5) / 1e5,
        at: now,
        accuracyM: Number.isFinite(fix.accuracyM)
          ? Math.round(fix.accuracyM)
          : undefined,
      });
    };

    const stopWatch = watchLocation(
      (fix) => {
        setError(null);
        setMyFix(fix);
        pushPresence(fix);
      },
      (err) => {
        setError(err.message || "Couldn't get your location");
        // Permission flipped to denied mid-session -> bail out so we
        // don't silently pretend to still be sharing.
        persistTarget(null);
      },
    );
    stopWatchRef.current = stopWatch;

    return () => {
      stopWatch();
      stopWatchRef.current = null;
      try {
        channel.untrack();
      } catch {
        /* already torn down */
      }
      supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
      setMyFix(null);
      lastPushRef.current = 0;
    };
  }, [target, userId, personaName, isAuthenticated, persistTarget]);

  const start = useCallback(
    (t: SharingTarget) => {
      setError(null);
      persistTarget(t);
    },
    [persistTarget],
  );

  const stop = useCallback(() => {
    setError(null);
    persistTarget(null);
  }, [persistTarget]);

  const isSharing = useCallback(
    (planId: string) => !!target && target.planId === planId,
    [target],
  );

  const value = useMemo<LocationSharingContextValue>(
    () => ({
      activePlanId: target?.planId ?? null,
      myFix,
      error,
      isSharing,
      start,
      stop,
    }),
    [target, myFix, error, isSharing, start, stop],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocationSharing() {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error(
      "useLocationSharing must be used within <LocationSharingProvider>",
    );
  }
  return v;
}

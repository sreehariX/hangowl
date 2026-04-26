"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled: boolean = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => clearInterval(id);
  }, [fetchData, intervalMs, enabled]);

  return { data, loading, error, refetch: fetchData };
}

export function useCountdown(expiresAt: string) {
  const [remaining, setRemaining] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Expired");
        setExpired(true);
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      if (hours > 0) {
        setRemaining(`${hours}h ${mins}m`);
      } else if (mins > 0) {
        setRemaining(`${mins}m ${secs}s`);
      } else {
        setRemaining(`${secs}s`);
      }
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return { remaining, expired };
}

function subscribeMediaQuery(query: string) {
  return (callback: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", callback);
    return () => mql.removeEventListener("change", callback);
  };
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    subscribeMediaQuery(query),
    () => window.matchMedia(query).matches,
    () => false
  );
}

/**
 * Lightweight admin gate. Returns the admin status of the current user, or
 * `null` while we don't yet know (i.e. before the auth state has resolved
 * or before the /admin/check round-trip completes). Callers typically
 * branch with `isAdmin === true` so the UI never flashes admin chrome for
 * a non-admin user during the in-flight request.
 *
 * The check is cached per session in `sessionStorage` so navigating
 * between pages doesn't re-hit the backend on every route change.
 */
export function useIsAdmin(): boolean | null {
  const { isAuthenticated, userId, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = sessionStorage.getItem("hangowl_is_admin");
      if (cached === "1") return true;
      if (cached === "0") return false;
    } catch {}
    return null;
  });

  // Signed-out users are definitively non-admin: derive that synchronously
  // (no setState-in-effect) so the UI never flashes admin chrome before the
  // effect runs.
  const definitelyNotAdmin = !authLoading && (!isAuthenticated || !userId);
  const effectiveIsAdmin = definitelyNotAdmin ? false : isAdmin;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !userId) return;
    let active = true;
    (async () => {
      try {
        const res = await api.checkAdmin();
        if (!active) return;
        setIsAdmin(res.is_admin);
        try {
          sessionStorage.setItem(
            "hangowl_is_admin",
            res.is_admin ? "1" : "0",
          );
        } catch {}
      } catch {
        if (active) setIsAdmin(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, userId]);

  return effectiveIsAdmin;
}

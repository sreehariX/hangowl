"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface NotificationsContextValue {
  unreadCount: number;
  pulse: boolean;
  clearUnread: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  pulse: false,
  clearUnread: () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, userId } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const fetchCount = () =>
      api.getUnreadCount().then((d) => setUnreadCount(d.count)).catch(() => {});

    fetchCount();

    const pulseNow = () => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    };

    const channel = supabase
      .channel(`nav-notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          setUnreadCount((c) => c + 1);
          pulseNow();
        }
      )
      .subscribe((status) => {
        // Re-fetch on reconnect in case we missed events while disconnected
        if (status === "SUBSCRIBED") fetchCount();
      });

    // Re-sync when the user returns to the app (mobile background → foreground)
    const onVisible = () => { if (document.visibilityState === "visible") fetchCount(); };
    document.addEventListener("visibilitychange", onVisible);

    // Safety-net poll. If the `notifications` table hasn't been added to the
    // supabase_realtime publication on a given deployment, INSERT events
    // never fire and the badge silently stalls. A low-frequency poll (30 s
    // while visible) guarantees the badge eventually catches up, and if
    // the count went up while the tab was hidden we also pulse so the
    // user actually notices. This never runs while the tab is hidden.
    let prevCount = 0;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const d = await api.getUnreadCount();
        setUnreadCount((current) => {
          if (d.count > current) pulseNow();
          prevCount = d.count;
          return d.count;
        });
      } catch { /* network blip, try again next tick */ }
    };
    void prevCount; // kept for symmetry; reserved for future "X new" summary
    const pollId = setInterval(tick, 30_000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(pollId);
    };
  }, [isAuthenticated, userId]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  return (
    <NotificationsContext.Provider value={{ unreadCount, pulse, clearUnread }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);

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

    const channel = supabase
      .channel(`nav-notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          setUnreadCount((c) => c + 1);
          setPulse(true);
          setTimeout(() => setPulse(false), 1000);
        }
      )
      .subscribe((status) => {
        // Re-fetch on reconnect in case we missed events while disconnected
        if (status === "SUBSCRIBED") fetchCount();
      });

    // Re-sync when the user returns to the app (mobile background → foreground)
    const onVisible = () => { if (document.visibilityState === "visible") fetchCount(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
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

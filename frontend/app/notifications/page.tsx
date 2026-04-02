"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import type { Notification } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

function NotifIcon({ type }: { type: Notification["type"] }) {
  if (type === "like") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15 text-base flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="text-red-400">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      </div>
    );
  }
  if (type === "reply") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15 text-base flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/15 text-base flex-shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    </div>
  );
}

function NotificationItem({
  n,
  onTap,
  isNew,
}: {
  n: Notification;
  onTap: (n: Notification) => void;
  isNew?: boolean;
}) {
  const actionText =
    n.type === "like"
      ? "liked your post"
      : n.type === "reply"
      ? "replied to your post"
      : "joined your hangout";

  return (
    <button
      onClick={() => onTap(n)}
      className={`relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05] active:scale-[0.99] ${
        isNew ? "bg-amber/[0.04]" : "bg-transparent"
      }`}
    >
      {isNew && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-amber flex-shrink-0" />
      )}
      <div className="relative flex-shrink-0 mt-0.5">
        <Avatar name={n.actor_persona || "?"} size={38} />
        <div className="absolute -bottom-1 -right-1">
          <NotifIcon type={n.type} />
        </div>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className={`text-[14px] leading-snug ${isNew ? "text-text" : "text-text-muted"}`}>
          <span className={`font-semibold ${isNew ? "text-text" : "text-text-muted"}`}>
            {n.actor_persona || "Someone"}
          </span>{" "}
          {actionText}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">{timeAgo(n.created_at)}</p>
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const { isAuthenticated, userId, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [queued, setQueued] = useState<Notification[]>([]);
  const markedReadRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/verify");
      return;
    }
    if (!authLoading && isAuthenticated) {
      load();
      const timer = setTimeout(() => {
        if (!markedReadRef.current) {
          markedReadRef.current = true;
          api.markAllRead().catch(() => {});
          setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, authLoading, load, router]);

  // Real-time: listen for new notifications while on this page
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const channel = supabase
      .channel(`notif-page-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as Notification;
          // Mark it as unread so it shows in "New" when flushed
          setQueued((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, userId]);

  function flushQueued() {
    setNotifications((prev) => {
      const ids = new Set(prev.map((n) => n.id));
      const fresh = queued.filter((n) => !ids.has(n.id));
      return [...fresh, ...prev];
    });
    setQueued([]);
  }

  const handleTap = useCallback(
    (n: Notification) => {
      if (n.post_id) {
        router.push(`/feed/${n.post_id}`);
      } else if (n.plan_id) {
        router.push(`/plan/${n.plan_id}`);
      }
    },
    [router]
  );

  const newNotifs = notifications.filter((n) => !n.is_read);
  const earlierNotifs = notifications.filter((n) => n.is_read);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-24">
      <div className="sticky top-0 z-10 border-b border-border bg-navy/95 px-4 py-4 backdrop-blur-md">
        <h1 className="text-xl font-bold text-text">Notifications</h1>
      </div>

      {/* Queued new notifications pill */}
      {queued.length > 0 && (
        <button
          onClick={flushQueued}
          className="sticky top-[61px] z-10 mx-auto mt-2 mb-1 flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-xs font-semibold text-navy shadow-lg shadow-amber/25 transition-all hover:bg-amber/90 active:scale-95 w-fit left-0 right-0 animate-slide-down-in"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          {queued.length} new notification{queued.length !== 1 ? "s" : ""}
        </button>
      )}

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-24 text-center">
          <span className="text-5xl">🔔</span>
          <p className="text-lg font-semibold text-text">All caught up</p>
          <p className="text-sm text-text-muted">
            Likes, replies, and hangout joins will show up here
          </p>
        </div>
      ) : (
        <div>
          {newNotifs.length > 0 && (
            <>
              <div className="px-4 py-2 pt-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber">
                  New
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {newNotifs.map((n) => (
                  <NotificationItem key={n.id} n={n} onTap={handleTap} isNew />
                ))}
              </div>
            </>
          )}

          {earlierNotifs.length > 0 && (
            <>
              <div className={`px-4 py-2 ${newNotifs.length > 0 ? "mt-3 border-t border-border/40" : "pt-3"}`}>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Earlier
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {earlierNotifs.map((n) => (
                  <NotificationItem key={n.id} n={n} onTap={handleTap} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

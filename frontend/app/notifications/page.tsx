"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
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

function NotificationIcon({ type }: { type: Notification["type"] }) {
  if (type === "like") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-lg flex-shrink-0">
        ❤️
      </div>
    );
  }
  if (type === "reply") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-lg flex-shrink-0">
        💬
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-lg flex-shrink-0">
      🤝
    </div>
  );
}

function notificationText(n: Notification): string {
  const actor = n.actor_persona || "Someone";
  if (n.type === "like") return `${actor} liked your post`;
  if (n.type === "reply") return `${actor} replied to your post`;
  if (n.type === "plan_join") return `${actor} joined your hangout`;
  return "New notification";
}

function NotificationItem({
  n,
  onTap,
}: {
  n: Notification;
  onTap: (n: Notification) => void;
}) {
  return (
    <button
      onClick={() => onTap(n)}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:scale-[0.98] ${
        n.is_read ? "bg-transparent" : "bg-amber/5"
      }`}
    >
      {!n.is_read && (
        <div className="absolute left-2 h-2 w-2 rounded-full bg-amber flex-shrink-0" />
      )}
      <NotificationIcon type={n.type} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${n.is_read ? "text-text-muted" : "text-text"}`}>
          <span className={`font-semibold ${n.is_read ? "text-text-muted" : "text-text"}`}>
            {n.actor_persona || "Someone"}
          </span>{" "}
          {n.type === "like" && "liked your post"}
          {n.type === "reply" && "replied to your post"}
          {n.type === "plan_join" && "joined your hangout"}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">{timeAgo(n.created_at)}</p>
      </div>
      {!n.is_read && (
        <div className="h-2.5 w-2.5 rounded-full bg-amber flex-shrink-0" />
      )}
    </button>
  );
}

export default function NotificationsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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
      // Mark all as read after a short delay (let user see the unread state first)
      const timer = setTimeout(() => {
        api.markAllRead().catch(() => {});
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, authLoading, load, router]);

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

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-24 text-center">
          <span className="text-5xl">🔔</span>
          <p className="text-lg font-semibold text-text">All caught up</p>
          <p className="text-sm text-text-muted">
            Likes, replies, and hangout joins will show up here
          </p>
        </div>
      ) : (
        <div className="relative">
          {newNotifs.length > 0 && (
            <>
              <div className="px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber">
                  New
                </span>
              </div>
              <div className="divide-y divide-border/40">
                {newNotifs.map((n) => (
                  <NotificationItem key={n.id} n={n} onTap={handleTap} />
                ))}
              </div>
            </>
          )}

          {earlierNotifs.length > 0 && (
            <>
              <div className="px-4 py-2 mt-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Earlier
                </span>
              </div>
              <div className="divide-y divide-border/40">
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

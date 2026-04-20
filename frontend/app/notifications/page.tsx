"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import type { Notification } from "@/lib/types";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  // For older: show "Mar 28" or "Mar 28, 2024" if different year
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return date.toLocaleDateString("en-US", opts);
}

function LikeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function JoinIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

const TYPE_META = {
  like: {
    icon: <LikeIcon />,
    color: "text-red-400",
    bg: "bg-red-500/15",
    label: "liked your post",
  },
  reply: {
    icon: <ReplyIcon />,
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    label: "replied to your post",
  },
  plan_join: {
    icon: <JoinIcon />,
    color: "text-amber",
    bg: "bg-amber/15",
    label: "joined your hangout",
  },
};

function NotificationItem({
  n,
  onTap,
  isNew,
}: {
  n: Notification;
  onTap: (n: Notification) => void;
  isNew?: boolean;
}) {
  const meta = TYPE_META[n.type];
  const preview = n.posts?.content ?? (n.plans ? `${n.plans.activity} · ${n.plans.location}` : null);

  return (
    <button
      onClick={() => onTap(n)}
      className={`relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-navy-lighter/55 active:bg-navy-lighter/70 ${
        isNew ? "bg-blue-500/[0.06]" : ""
      }`}
    >
      {/* Unread dot */}
      {isNew && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
      )}

      {/* Action icon column — fixed width, like Twitter */}
      <div className="flex w-10 flex-shrink-0 flex-col items-end pt-0.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${meta.bg} ${meta.color}`}>
          {meta.icon}
        </div>
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {/* Avatar row */}
        <div className="mb-2 flex items-center gap-1">
          <Avatar name={n.actor_persona || "?"} size={34} />
        </div>

        {/* Action text */}
        <p className="text-[14px] leading-snug">
          <span className="font-bold text-text-primary">{n.actor_persona || "Someone"}</span>{" "}
          <span className="text-text-muted">{meta.label}</span>
        </p>

        {/* Post/plan preview */}
        {preview && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-text-muted/70 border-l-2 border-border/60 pl-2">
            {preview}
          </p>
        )}

        {/* Timestamp */}
        <p className="mt-1.5 text-xs text-text-muted/50">{formatDate(n.created_at)}</p>
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const { isAuthenticated, userId, loading: authLoading } = useAuth();
  const { clearUnread } = useNotifications();
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
          clearUnread();
          setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, authLoading, load, router, clearUnread]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const channel = supabase
      .channel(`notif-page-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const incoming = payload.new as Notification;
          setQueued((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
      if (n.post_id) router.push(`/feed/${n.post_id}`);
      else if (n.plan_id) router.push(`/plan/${n.plan_id}`);
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
    <div className="app-shell min-h-screen pt-4">
      <div className="app-content pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 glass-surface border-b border-border/80 px-4 py-3.5 backdrop-blur-md">
        <h1 className="text-xl font-bold text-text-primary">Notifications</h1>
      </div>

      {/* New notifications pill */}
      {queued.length > 0 && (
        <div className="sticky top-[57px] z-10 flex justify-center pt-2">
          <button
            onClick={flushQueued}
            className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-400 active:scale-95 animate-slide-down-in"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            {queued.length} new
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-border/40">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </div>
          <p className="text-lg font-bold text-text-primary">Nothing yet</p>
          <p className="text-sm text-text-muted">Likes, replies, and hangout joins will show up here</p>
        </div>
      ) : (
        <div>
          {newNotifs.length > 0 && (
            <>
              <div className="px-4 pb-1 pt-3">
                <span className="text-[13px] font-bold text-text-primary">New</span>
              </div>
              <div className="divide-y divide-border/20">
                {newNotifs.map((n) => (
                  <NotificationItem key={n.id} n={n} onTap={handleTap} isNew />
                ))}
              </div>
            </>
          )}

          {earlierNotifs.length > 0 && (
            <>
              <div className={`px-4 pb-1 ${newNotifs.length > 0 ? "mt-4 border-t border-border/30 pt-3" : "pt-3"}`}>
                <span className="text-[13px] font-bold text-text-primary">Earlier</span>
              </div>
              <div className="divide-y divide-border/20">
                {earlierNotifs.map((n) => (
                  <NotificationItem key={n.id} n={n} onTap={handleTap} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

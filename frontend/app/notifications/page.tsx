"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import { EmptyState, Spinner } from "@/components/primitives";
import {
  BellIcon,
  ChevronUpIcon,
  HeartIcon,
  ReplyIcon,
  UsersIcon,
} from "@/components/icons";
import type { Notification } from "@/lib/types";

function formatDate(dateStr: string) {
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
  return date.toLocaleDateString("en-US",
    date.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" });
}

type NotifType = Notification["type"];

const TYPE_META: Record<NotifType, { icon: React.ReactNode; tone: string; label: string }> = {
  like: { icon: <HeartIcon filled size={14} />, tone: "bg-danger/15 text-danger", label: "liked your post" },
  reply: { icon: <ReplyIcon size={14} />, tone: "bg-info/15 text-info", label: "replied to your post" },
  plan_join: { icon: <UsersIcon size={14} />, tone: "bg-amber/15 text-amber", label: "joined your hangout" },
};

function NotificationItem({
  n, onTap, isNew,
}: { n: Notification; onTap: (n: Notification) => void; isNew?: boolean }) {
  const meta = TYPE_META[n.type];
  const preview = n.posts?.content ?? (n.plans ? `${n.plans.activity} · ${n.plans.location}` : null);

  return (
    <button
      onClick={() => onTap(n)}
      className={`relative flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-hover/40 ${
        isNew ? "bg-amber/[0.04]" : ""
      }`}
    >
      {isNew && (
        <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-amber" />
      )}

      <div className="relative shrink-0">
        <Avatar name={n.actor_persona || "?"} size={40} />
        <span
          className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-black ${meta.tone}`}
        >
          {meta.icon}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-body leading-snug">
          <span className="font-semibold text-text-primary">
            {n.actor_persona || "Someone"}
          </span>{" "}
          <span className="text-text-tertiary">{meta.label}</span>
        </p>

        {preview && (
          <p className="mt-1 line-clamp-2 border-l-2 border-border pl-2 text-caption text-text-tertiary">
            {preview}
          </p>
        )}

        <p className="mt-1 text-[11px] text-text-muted">
          {formatDate(n.created_at)}
        </p>
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
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace("/verify"); return; }
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
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const incoming = payload.new as Notification;
          setQueued((prev) =>
            prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev],
          );
        })
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

  const handleTap = useCallback((n: Notification) => {
    if (n.post_id) router.push(`/feed/${n.post_id}`);
    else if (n.plan_id) router.push(`/plan/${n.plan_id}`);
  }, [router]);

  const newNotifs = notifications.filter((n) => !n.is_read);
  const earlierNotifs = notifications.filter((n) => n.is_read);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={22} />
      </div>
    );
  }

  return (
    <div className="app-shell pt-0">
      <div className="app-content">
        <div className="sticky-bar">
          <h1 className="text-[17px] font-semibold text-text-primary">
            Notifications
          </h1>
        </div>

        {queued.length > 0 && (
          <div className="flex justify-center py-2">
            <button
              onClick={flushQueued}
              className="flex animate-slide-down-in items-center gap-1.5 rounded-full bg-amber px-4 py-1 text-xs font-semibold text-ink-950"
            >
              <ChevronUpIcon size={12} />
              {queued.length} new
            </button>
          </div>
        )}

        {notifications.length === 0 ? (
          <EmptyState
            icon={<BellIcon size={22} />}
            title="Nothing yet"
            description="Likes, replies, and hangout joins will show up here."
          />
        ) : (
          <>
            {newNotifs.length > 0 && (
              <>
                <div className="px-4 pb-1 pt-4">
                  <span className="section-eyebrow text-amber">New</span>
                </div>
                {newNotifs.map((n) => (
                  <NotificationItem key={n.id} n={n} onTap={handleTap} isNew />
                ))}
              </>
            )}

            {earlierNotifs.length > 0 && (
              <>
                <div className="px-4 pb-1 pt-4">
                  <span className="section-eyebrow">Earlier</span>
                </div>
                {earlierNotifs.map((n) => (
                  <NotificationItem key={n.id} n={n} onTap={handleTap} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

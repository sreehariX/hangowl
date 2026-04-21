"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/primitives";
import {
  CheckIcon,
  ChevronDownIcon,
  SendIcon,
} from "@/components/icons";
import type { PlanMessage } from "@/lib/types";

interface PlanChatProps {
  planId: string;
  /**
   * Layout variant.
   *  - "card"  (default): self-contained rounded panel with header + fixed
   *    scroller height. Used standalone on /plan/[id].
   *  - "fill": fills the parent's height. The scroller grows to take
   *    whatever the parent gives it (used inside PlanDock's full-screen
   *    sheet so the chat gets the entire viewport — finally scrollable
   *    without fighting the outer page scroll).
   */
  variant?: "card" | "fill";
  /** Hide the internal header. The dock renders its own chrome. */
  hideHeader?: boolean;
}

interface UiMessage extends PlanMessage {
  /** "optimistic" = sent by us, not yet echoed from the server.
   *  "sent"       = server-confirmed; draws the single tick.
   *  "delivered"  = echoed back from realtime; draws the double tick.
   *  Only meaningful for our own outgoing messages. */
  status?: "optimistic" | "sent" | "delivered";
}

const MAX_LEN = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const NEAR_BOTTOM_PX = 80;

/* ── Helpers ─────────────────────────────────────────────────────────── */

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDayLabel(iso: string): string {
  const now = Date.now();
  const today = startOfDay(now);
  const yesterday = today - DAY_MS;
  const ms = new Date(iso).getTime();
  const day = startOfDay(ms);

  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";

  const date = new Date(ms);
  if (now - day < 6 * DAY_MS) {
    return date.toLocaleDateString("en-IN", { weekday: "long" });
  }
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date(now).getFullYear() ? "numeric" : undefined,
  });
}

/* ── Bubble rendering ────────────────────────────────────────────────── */

interface RenderMeta {
  /** First bubble in a same-sender run (draws avatar on other side, name above). */
  isFirstInGroup: boolean;
  /** Last bubble in a same-sender run (draws the tail on the bubble). */
  isLastInGroup: boolean;
}

function Bubble({
  msg,
  isMe,
  meta,
}: {
  msg: UiMessage;
  isMe: boolean;
  meta: RenderMeta;
}) {
  const { isFirstInGroup, isLastInGroup } = meta;
  const name = msg.users?.persona_name ?? "Anonymous";

  const bubbleClass = [
    "chat-bubble",
    isMe ? "chat-bubble-me" : "chat-bubble-them",
    isLastInGroup ? (isMe ? "chat-bubble-tail-me" : "chat-bubble-tail-them") : "",
    !isFirstInGroup ? "chat-bubble-cont" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const tickTone =
    msg.status === "delivered"
      ? "text-info"
      : "text-amber/60";

  return (
    <div
      className={`flex items-end gap-2 ${
        isMe ? "flex-row-reverse" : "flex-row"
      } ${isFirstInGroup ? "mt-2" : "mt-0.5"}`}
    >
      {!isMe && (
        <div
          className={`w-7 shrink-0 ${
            isLastInGroup ? "visible" : "invisible"
          }`}
        >
          <Avatar name={name} size={28} />
        </div>
      )}

      <div
        className={`flex max-w-[78%] flex-col ${
          isMe ? "items-end" : "items-start"
        }`}
      >
        {!isMe && isFirstInGroup && (
          <p className="ml-3 mb-0.5 text-[11px] font-semibold tracking-tight text-text-tertiary">
            {name}
          </p>
        )}

        <div className={bubbleClass}>
          <p className="whitespace-pre-wrap break-words text-[14.5px] leading-snug">
            {msg.message}
          </p>
          <span className="chat-meta">
            <span className="tabular-nums">{formatTime(msg.created_at)}</span>
            {isMe && (
              <span className={`inline-flex items-center ${tickTone}`}>
                {msg.status === "optimistic" ? (
                  <Spinner size={9} tone="muted" />
                ) : msg.status === "delivered" ? (
                  <>
                    <CheckIcon size={11} className="-mr-1.5" />
                    <CheckIcon size={11} />
                  </>
                ) : (
                  <CheckIcon size={11} />
                )}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function DayDivider({ iso }: { iso: string }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-surface-hover/80 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-tertiary backdrop-blur">
        {formatDayLabel(iso)}
      </span>
    </div>
  );
}

function UnreadDivider({ count }: { count: number }) {
  return (
    <div
      className="my-3 flex items-center gap-2 px-2"
      role="separator"
      aria-label={`${count} unread messages`}
    >
      <div className="h-px flex-1 bg-amber/40" />
      <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-amber">
        {count} new
      </span>
      <div className="h-px flex-1 bg-amber/40" />
    </div>
  );
}

function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `${names[0]} and ${names.length - 1} others are typing`;
  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="w-7 shrink-0" />
      <div className="chat-bubble chat-bubble-them chat-bubble-typing">
        <div className="chat-typing-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────────────── */

export function PlanChat({ planId, variant = "card", hideHeader = false }: PlanChatProps) {
  const { isAuthenticated, userId, personaName } = useAuth();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; at: number }>>(
    new Map(),
  );
  const [unreadWhileScrolledUp, setUnreadWhileScrolledUp] = useState(0);
  const [firstUnseenId, setFirstUnseenId] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldStickToBottomRef = useRef(true);

  /* Initial load */
  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getMessages(planId)
      .then((data) => {
        if (!active) return;
        setMessages(
          data.messages.map((m) => ({
            ...m,
            status: m.user_id === userId ? "sent" : undefined,
          })),
        );
        setLoading(false);
        requestAnimationFrame(() => {
          const el = scrollerRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [planId, userId]);

  /* Realtime: new messages + typing broadcasts */
  useEffect(() => {
    if (!planId) return;

    const channel = supabase
      .channel(`chat-${planId}`, { config: { broadcast: { self: false } } })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plan_messages",
          filter: `plan_id=eq.${planId}`,
        },
        (payload) => {
          const incoming = payload.new as PlanMessage;
          setMessages((prev) => {
            // Reconcile an earlier optimistic bubble from us with the
            // server echo by matching user+message+close timestamp.
            if (incoming.user_id === userId) {
              const idx = prev.findIndex(
                (m) =>
                  m.status === "optimistic" &&
                  m.user_id === incoming.user_id &&
                  m.message === incoming.message,
              );
              if (idx >= 0) {
                const next = prev.slice();
                next[idx] = { ...incoming, status: "delivered", users: prev[idx].users };
                return next;
              }
            }
            if (prev.some((m) => m.id === incoming.id)) return prev;

            // Someone else's message arrived while we're scrolled up.
            const scroller = scrollerRef.current;
            if (
              scroller &&
              scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight >
                NEAR_BOTTOM_PX &&
              incoming.user_id !== userId
            ) {
              setUnreadWhileScrolledUp((c) => c + 1);
              setFirstUnseenId((cur) => cur ?? incoming.id);
            }

            return [
              ...prev,
              { ...incoming, status: incoming.user_id === userId ? "delivered" : undefined },
            ];
          });

          // A user pinging a message clears their own typing entry.
          if (incoming.user_id !== userId) {
            setTypingUsers((prev) => {
              if (!prev.has(incoming.user_id)) return prev;
              const next = new Map(prev);
              next.delete(incoming.user_id);
              return next;
            });
          }
        },
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        const data = payload.payload as { userId: string; name: string };
        if (!data?.userId || data.userId === userId) return;
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(data.userId, { name: data.name || "Someone", at: Date.now() });
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [planId, userId]);

  /* Sweep stale typing entries every 2.5s so the indicator vanishes if a
   * user stops mid-word without firing a new broadcast. */
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        if (prev.size === 0) return prev;
        let changed = false;
        const next = new Map(prev);
        for (const [uid, v] of next) {
          if (now - v.at > 4_500) {
            next.delete(uid);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2_500);
    return () => clearInterval(id);
  }, []);

  /* Auto-scroll when new messages arrive, but only if we were already at
   * the bottom before the new message landed. */
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (shouldStickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, typingUsers.size]);

  /* Observe scroll position so the "jump to bottom" FAB + unread badge
   * only show when meaningful. */
  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    shouldStickToBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setUnreadWhileScrolledUp(0);
      setFirstUnseenId(null);
    }
  }, []);

  /* Typing broadcast, throttled so a fast typer doesn't spam the channel. */
  const broadcastTyping = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || !userId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2_000) return;
    lastTypingSentRef.current = now;
    ch.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, name: personaName ?? "Anonymous" },
    });
  }, [userId, personaName]);

  /* Composer: auto-grow textarea to a cap. */
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  const trimmed = input.trim();
  const canSend = trimmed.length > 0 && !sending && isAuthenticated;

  const doSend = useCallback(async () => {
    if (!canSend || !userId) return;
    const text = trimmed;
    setSending(true);

    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: UiMessage = {
      id: tempId,
      plan_id: planId,
      user_id: userId,
      message: text,
      created_at: new Date().toISOString(),
      users: { persona_name: personaName ?? "You" },
      status: "optimistic",
    };
    shouldStickToBottomRef.current = true;
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    // Also clear our own typing-indicator broadcast on send. We can't
    // "untype" a previous broadcast explicitly (presence untrack is for
    // tracked state, not broadcast), but swapping in the new message
    // and resetting the throttle so the next keystroke can emit again
    // is the closest proxy.
    lastTypingSentRef.current = 0;
    if (typingClearTimeoutRef.current) {
      clearTimeout(typingClearTimeoutRef.current);
      typingClearTimeoutRef.current = null;
    }

    try {
      const res = await api.sendMessage(planId, text);
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === tempId);
        if (idx < 0) return prev;
        if (prev.some((m) => m.id === res.message.id && m.id !== tempId)) {
          // Realtime echo beat the HTTP reply. Drop the optimistic row.
          return prev.filter((m) => m.id !== tempId);
        }
        const next = prev.slice();
        next[idx] = {
          ...res.message,
          status: "sent",
          users: res.message.users ?? optimistic.users,
        };
        return next;
      });
    } catch {
      // Keep the optimistic bubble, mark it as failed by clearing status
      // so the user sees the text and can retry by sending again.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: undefined } : m,
        ),
      );
      setInput(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [canSend, planId, trimmed, userId, personaName]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // WhatsApp/Slack/iMessage behaviour: Enter sends (on desktop), Shift+Enter
    // inserts a newline. On touch devices we keep Enter as newline and rely
    // on the send button, because virtual keyboards don't have Shift+Enter.
    const isDesktop =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: fine)").matches;
    if (e.key === "Enter" && !e.shiftKey && isDesktop) {
      e.preventDefault();
      doSend();
    } else if (e.key.length === 1 || e.key === "Backspace") {
      broadcastTyping();
    }
  }

  function scrollToBottomSmooth() {
    shouldStickToBottomRef.current = true;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setUnreadWhileScrolledUp(0);
    setFirstUnseenId(null);
  }

  /* Group messages with day dividers + same-sender merging. */
  const rendered = useMemo(() => {
    const out: React.ReactNode[] = [];
    let lastSender = "";
    let lastDay = -1;
    let unreadRendered = false;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const day = startOfDay(new Date(m.created_at).getTime());
      if (day !== lastDay) {
        out.push(<DayDivider key={`d-${day}-${m.id}`} iso={m.created_at} />);
        lastSender = "";
        lastDay = day;
      }

      if (
        firstUnseenId === m.id &&
        !unreadRendered &&
        unreadWhileScrolledUp > 0
      ) {
        out.push(
          <UnreadDivider
            key={`u-${m.id}`}
            count={unreadWhileScrolledUp}
          />,
        );
        unreadRendered = true;
        lastSender = "";
      }

      const next = messages[i + 1];
      const nextDay = next
        ? startOfDay(new Date(next.created_at).getTime())
        : null;
      const sameSenderNext = next && next.user_id === m.user_id && nextDay === day;
      const sameSenderPrev = m.user_id === lastSender;
      const meta: RenderMeta = {
        isFirstInGroup: !sameSenderPrev,
        isLastInGroup: !sameSenderNext,
      };
      lastSender = m.user_id;

      out.push(
        <Bubble
          key={m.id}
          msg={m}
          isMe={m.user_id === userId}
          meta={meta}
        />,
      );
    }
    return out;
  }, [messages, userId, firstUnseenId, unreadWhileScrolledUp]);

  const typingNames = useMemo(
    () => Array.from(typingUsers.values()).map((v) => v.name),
    [typingUsers],
  );

  const isFill = variant === "fill";
  const sectionClass = isFill
    ? "chat-panel chat-panel-fill h-full"
    : "surface-panel overflow-hidden chat-panel";
  const scrollerClass = isFill
    ? "chat-scroller chat-scroller-fill relative flex-1 min-h-0 overflow-y-auto px-3 py-3"
    : "chat-scroller relative overflow-y-auto px-3 py-3";

  return (
    <section className={sectionClass}>
      {!hideHeader && (
        <header className="flex items-center gap-2.5 border-b border-border bg-surface px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/15 text-amber">
            <SendIcon size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-body font-semibold text-text-primary">
              Group chat
            </h3>
            <p className="text-[11px] text-text-tertiary">
              {typingNames.length > 0
                ? typingNames.length === 1
                  ? `${typingNames[0]} is typing…`
                  : `${typingNames.length} people typing…`
                : messages.length > 0
                ? `${messages.length} message${messages.length === 1 ? "" : "s"}`
                : "Say hi to everyone going"}
            </p>
          </div>
        </header>
      )}

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className={scrollerClass}
      >
        {loading && (
          <div className="flex justify-center py-10">
            <Spinner size={16} />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
            <span className="mb-2 text-2xl" aria-hidden>
              💬
            </span>
            <p className="text-body font-semibold text-text-primary">
              No messages yet
            </p>
            <p className="max-w-[240px] text-caption text-text-tertiary">
              Coordinate meeting time, pickup points, or just keep the vibe going.
            </p>
          </div>
        )}

        {rendered}

        {typingNames.length > 0 && <TypingIndicator names={typingNames} />}

        <div ref={endRef} />

        {!isAtBottom && (
          <button
            type="button"
            onClick={scrollToBottomSmooth}
            className="chat-jump-btn"
            aria-label="Jump to latest message"
          >
            <ChevronDownIcon size={16} />
            {unreadWhileScrolledUp > 0 && (
              <span className="chat-jump-badge tabular-nums">
                {unreadWhileScrolledUp > 99 ? "99+" : unreadWhileScrolledUp}
              </span>
            )}
          </button>
        )}
      </div>

      {isAuthenticated ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            doSend();
          }}
          className="flex items-end gap-2 border-t border-border bg-surface px-3 py-2.5"
        >
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={handleKeyDown}
              placeholder="Message"
              rows={1}
              className="chat-textarea"
              aria-label="Message"
            />
            {input.length > MAX_LEN - 80 && (
              <span
                className={`pointer-events-none absolute bottom-1 right-3 text-[10px] tabular-nums ${
                  input.length >= MAX_LEN ? "text-danger" : "text-text-muted"
                }`}
              >
                {MAX_LEN - input.length}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!canSend}
            className="chat-send-btn"
            aria-label="Send"
          >
            {sending ? <Spinner size={14} tone="ink" /> : <SendIcon size={16} />}
          </button>
        </form>
      ) : (
        <div className="border-t border-border p-4 text-center">
          <p className="text-caption text-text-tertiary">Sign in to chat</p>
        </div>
      )}
    </section>
  );
}

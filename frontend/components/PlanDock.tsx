"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LatLng } from "@/lib/maps";
import { LivePresenceMap } from "@/components/LivePresenceMap";
import { PlanChat } from "@/components/PlanChat";
import {
  CloseIcon,
  MapIcon,
  MessageCircleIcon,
} from "@/components/icons";

interface PlanDockProps {
  planId: string;
  hostId: string;
  destination?: LatLng | null;
  destinationLabel?: string;
  /** Whether the viewer has joined the plan. Non-members don't get the map
   *  tab (no presence to show) but still see the chat. */
  canSeeMap: boolean;
}

type Tab = "map" | "chat";

/**
 * Zepto-style bottom dock that unifies the live map and the group chat.
 *
 * Design:
 *  - Collapsed: a compact pill sits at the bottom of the plan page. It
 *    carries the plan's live pulse — "3 people sharing live · 2 new
 *    messages" — and a preview glimpse of the latest message. No nested
 *    scroller, so the outer page scrolls freely when the user's thumb
 *    rests over it.
 *  - Expanded: a full-screen sheet slides up (iOS Live Activity /
 *    Uber driver-sheet / Zepto order-tracker pattern). Segmented Map /
 *    Chat tabs let the user pick which one fills the entire viewport.
 *    The map gets the whole screen (finally visible). The chat gets the
 *    whole screen (finally scrollable without fighting the page).
 *  - Escape, tap on backdrop, and the close button all collapse back
 *    down. Body scroll is locked while the sheet is open — no more
 *    scroll-trap confusion.
 *
 * This single component replaces the two inline sections on the plan
 * page (each with their own fixed-height scroller) so the user only ever
 * has ONE scroller interacting with the page at a time.
 */
export function PlanDock({
  planId,
  hostId,
  destination,
  destinationLabel,
  canSeeMap,
}: PlanDockProps) {
  const [open, setOpen] = useState(false);
  const [rawTab, setRawTab] = useState<Tab>(canSeeMap ? "map" : "chat");
  // Non-members can never land on the map tab, even if a stale state
  // value says otherwise — derive rather than sync in an effect.
  const tab: Tab = !canSeeMap ? "chat" : rawTab;
  const [unreadChat, setUnreadChat] = useState(0);
  const [latestPreview, setLatestPreview] = useState<{
    name: string;
    text: string;
  } | null>(null);
  /** How many people are currently sharing their live location on this
   *  plan, including this user. Powers the "3 live" copy under the Map
   *  chip. Read from the same presence channel the map itself uses so
   *  both surfaces stay in sync. */
  const [liveCount, setLiveCount] = useState(0);

  // Refs so the realtime callback always sees the latest open/tab without
  // resubscribing on every render.
  const openRef = useRef(open);
  const tabRef = useRef<Tab>(tab);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  /* Live unread + preview for the collapsed pill. Subscribes to the same
   * postgres INSERT stream the chat uses so the dock feels alive before
   * the sheet is even opened. */
  useEffect(() => {
    if (!planId) return;
    const channel = supabase
      .channel(`dock-${planId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plan_messages",
          filter: `plan_id=eq.${planId}`,
        },
        (payload) => {
          const row = payload.new as {
            message: string;
            users?: { persona_name?: string | null } | null;
          };
          const name = row.users?.persona_name ?? "Someone";
          const text = (row.message ?? "").slice(0, 80);
          setLatestPreview({ name, text });
          // Don't bump the unread counter while the sheet is open on chat
          // — the user is already looking at it.
          if (!(openRef.current && tabRef.current === "chat")) {
            setUnreadChat((n) => n + 1);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [planId]);

  /* Peek at the same Supabase Presence channel the map uses, just to know
   *  how many people are live. Keeps the dock chip honest ("3 live") even
   *  before the user opens the map. */
  useEffect(() => {
    if (!planId || !canSeeMap) return;
    const channel = supabase.channel(`plan-presence-${planId}`, {
      config: { presence: { key: `dock-peek-${Math.random().toString(36).slice(2, 8)}` } },
    });
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      // Each key is one user; count distinct keys that actually carry a
      // lat/lng payload (someone may be subscribed without sharing).
      let n = 0;
      for (const key of Object.keys(state)) {
        const arr = state[key] as Array<{ lat?: number; lng?: number }>;
        if (arr?.some((p) => typeof p.lat === "number" && typeof p.lng === "number")) {
          n += 1;
        }
      }
      setLiveCount(n);
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [planId, canSeeMap]);

  const openDock = useCallback(
    (nextTab?: Tab) => {
      if (nextTab) setRawTab(nextTab);
      setOpen(true);
      // Opening the dock acknowledges whatever the user was going to see.
      setUnreadChat(0);
    },
    [],
  );

  const closeDock = useCallback(() => {
    setOpen(false);
  }, []);

  const selectTab = useCallback((next: Tab) => {
    setRawTab(next);
    if (next === "chat") setUnreadChat(0);
  }, []);

  /* Lock body scroll + ESC-to-close while the sheet is open. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDock();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeDock]);

  const chatSubline = latestPreview
    ? `${latestPreview.name}: ${latestPreview.text}`
    : unreadChat > 0
    ? `${unreadChat} new ${unreadChat === 1 ? "message" : "messages"}`
    : "Say hi to everyone going";

  const mapSubline =
    liveCount > 0
      ? `${liveCount} sharing live`
      : "See who's on the way";

  return (
    <>
      {/* Collapsed dock. Two chips (Map + Chat) fused into one pill so the
       * user can see at a glance that *both* surfaces exist. Each chip is
       * its own tap target that opens the sheet on the matching tab.
       * Sticky to the viewport bottom above the bottom nav, iOS Live
       * Activity proportions. */}
      <div className="plan-dock-rail pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3">
        <div
          className="plan-dock-pill pointer-events-auto"
          role="group"
          aria-label="Live hangout dock"
        >
          <span className="plan-dock-pill-glow" aria-hidden />

          {canSeeMap && (
            <>
              <button
                type="button"
                onClick={() => openDock("map")}
                className="plan-dock-chip"
                aria-label="Open live map"
              >
                <span className="plan-dock-chip-icon plan-dock-chip-icon--map" aria-hidden>
                  <MapIcon size={14} />
                  {liveCount > 0 && (
                    <span className="plan-dock-live-dot" aria-hidden>
                      <span className="plan-dock-live-pulse" />
                    </span>
                  )}
                </span>
                <span className="plan-dock-chip-text">
                  <span className="plan-dock-chip-label">Map</span>
                  <span className="plan-dock-chip-sub">{mapSubline}</span>
                </span>
              </button>
              <span className="plan-dock-divider" aria-hidden />
            </>
          )}

          <button
            type="button"
            onClick={() => openDock("chat")}
            className="plan-dock-chip plan-dock-chip--chat"
            aria-label="Open group chat"
          >
            <span className="plan-dock-chip-icon plan-dock-chip-icon--chat" aria-hidden>
              <MessageCircleIcon size={14} />
              {unreadChat > 0 && (
                <span className="plan-dock-chip-badge tabular-nums" aria-hidden>
                  {unreadChat > 9 ? "9+" : unreadChat}
                </span>
              )}
            </span>
            <span className="plan-dock-chip-text">
              <span className="plan-dock-chip-label">
                Chat
                {unreadChat > 0 && (
                  <span className="plan-dock-chip-count tabular-nums">
                    · {unreadChat > 99 ? "99+" : unreadChat}
                  </span>
                )}
              </span>
              <span className="plan-dock-chip-sub">{chatSubline}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Expanded full-screen sheet. */}
      {open && (
        <div
          className="fixed inset-0 z-[90] flex flex-col bg-ink-900/80 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-label="Live hangout"
          onClick={closeDock}
        >
          <div
            className="mx-auto flex h-full w-full max-w-[640px] flex-col bg-ink-900 animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky-bar">
              <button
                type="button"
                onClick={closeDock}
                className="icon-btn"
                aria-label="Close"
              >
                <CloseIcon size={20} />
              </button>

              <div className="mx-auto flex rounded-full bg-surface-hover p-1">
                {canSeeMap && (
                  <button
                    type="button"
                    onClick={() => selectTab("map")}
                    className={`plan-dock-tab ${
                      tab === "map" ? "is-active" : ""
                    }`}
                    aria-pressed={tab === "map"}
                  >
                    <MapIcon size={14} />
                    Map
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => selectTab("chat")}
                  className={`plan-dock-tab ${
                    tab === "chat" ? "is-active" : ""
                  }`}
                  aria-pressed={tab === "chat"}
                >
                  <MessageCircleIcon size={14} />
                  Chat
                  {unreadChat > 0 && (
                    <span className="plan-dock-tab-badge tabular-nums">
                      {unreadChat > 99 ? "99+" : unreadChat}
                    </span>
                  )}
                </button>
              </div>

              <span className="w-9" />
            </div>

            {/* Keep both panels mounted so realtime stays subscribed and
             * switching tabs is instant. Hidden one has its height zeroed
             * so it can't grab scroll. */}
            <div className="relative flex-1 min-h-0">
              {canSeeMap && (
                <div
                  className={`absolute inset-0 ${
                    tab === "map" ? "" : "invisible pointer-events-none"
                  }`}
                  aria-hidden={tab !== "map"}
                >
                  <LivePresenceMap
                    planId={planId}
                    hostId={hostId}
                    destination={destination}
                    destinationLabel={destinationLabel}
                    variant="fill"
                  />
                </div>
              )}
              <div
                className={`absolute inset-0 ${
                  tab === "chat" ? "" : "invisible pointer-events-none"
                }`}
                aria-hidden={tab !== "chat"}
              >
                <PlanChat planId={planId} variant="fill" hideHeader />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

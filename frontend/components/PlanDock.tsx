"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PlanChat } from "@/components/PlanChat";
import {
  CloseIcon,
  MessageCircleIcon,
} from "@/components/icons";

interface PlanDockProps {
  planId: string;
}

/**
 * Plan page chat launcher.
 *
 * Collapsed: a circular FAB pinned to the bottom-right of the plan
 *   page — identical position grammar to the "Create hangout" / "New
 *   post" buttons elsewhere in the app, so the tap target lives where
 *   thumbs expect it. It carries a small LIVE dot when unread
 *   messages have arrived, Zepto / WhatsApp style.
 *
 * Expanded: the full-screen chat sheet slides up. Backdrop tap,
 *   close button, and Escape all collapse it back. Body scroll is
 *   locked while open so the chat gets the whole viewport with no
 *   outer-page scroll fighting the inner list.
 *
 * The live map is now a first-class inline card at the top of the
 * plan page, not a tab inside this dock — keeps the chat FAB simple
 * and the map glanceable without having to open anything.
 */
export function PlanDock({ planId }: PlanDockProps) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [latestPreview, setLatestPreview] = useState<{
    name: string;
    text: string;
  } | null>(null);

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  /* Live unread + preview for the collapsed FAB. Subscribes to the
   * same postgres INSERT stream the chat uses so the dot lights up
   * immediately, even before the user opens the sheet. */
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
            user_id?: string;
            message: string;
            users?: { persona_name?: string | null } | null;
          };
          // Ignore the echo of our own message.
          if (userId && row.user_id === userId) return;
          const name = row.users?.persona_name ?? "Someone";
          const text = (row.message ?? "").slice(0, 80);
          setLatestPreview({ name, text });
          if (!openRef.current) {
            setUnreadChat((n) => n + 1);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [planId, userId]);

  const openDock = useCallback(() => {
    setOpen(true);
    setUnreadChat(0);
  }, []);

  const closeDock = useCallback(() => {
    setOpen(false);
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

  const subline = latestPreview
    ? `${latestPreview.name}: ${latestPreview.text}`
    : "Open group chat";

  return (
    <>
      {/* Collapsed FAB. Bottom-right, above the bottom nav; mirrors
       * the Post FAB's position grammar so the thumb always lands on
       * the right action. */}
      <button
        type="button"
        onClick={openDock}
        className="chat-fab bottom-24 right-4 md:bottom-8 md:right-[max(16px,calc(50%-340px+16px))]"
        aria-label={
          unreadChat > 0
            ? `Open group chat, ${unreadChat} unread`
            : "Open group chat"
        }
        title={subline}
      >
        <MessageCircleIcon size={22} />
        {unreadChat > 0 && (
          <span
            className="chat-fab-badge tabular-nums"
            aria-hidden
          >
            {unreadChat > 9 ? "9+" : unreadChat}
          </span>
        )}
        <span className="chat-fab-ping" aria-hidden />
      </button>

      {/* Expanded full-screen sheet. */}
      {open && (
        <div
          className="fixed inset-0 z-[90] flex flex-col bg-ink-900/80 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-label="Group chat"
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
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/15 text-amber">
                  <MessageCircleIcon size={14} />
                </span>
                <span className="text-[15px] font-semibold text-text-primary">
                  Group chat
                </span>
              </div>
              <span className="w-9" />
            </div>

            <div className="relative flex-1 min-h-0">
              <div className="absolute inset-0">
                <PlanChat planId={planId} variant="fill" hideHeader />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

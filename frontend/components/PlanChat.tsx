"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/primitives";
import { SendIcon } from "@/components/icons";
import type { PlanMessage } from "@/lib/types";

interface PlanChatProps {
  planId: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

export function PlanChat({ planId }: PlanChatProps) {
  const { isAuthenticated, userId } = useAuth();
  const [messages, setMessages] = useState<PlanMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const scrollToBottom = () => {
    const el = containerRef.current;
    if (el && shouldAutoScroll.current) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    let active = true;
    api.getMessages(planId)
      .then((data) => {
        if (!active) return;
        setMessages(data.messages);
        setLoading(false);
        requestAnimationFrame(() => {
          if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
        });
      })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [planId]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${planId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "plan_messages", filter: `plan_id=eq.${planId}` },
        (payload) => {
          const newMsg = payload.new as PlanMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg],
          );
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [planId]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    shouldAutoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || !isAuthenticated) return;
    setSending(true);
    shouldAutoScroll.current = true;
    try {
      const data = await api.sendMessage(planId, text);
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message],
      );
      setInput("");
    } catch {}
    finally { setSending(false); }
  }

  let lastSender = "";

  return (
    <div className="surface-panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber/15 text-amber">
          <SendIcon size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-body font-semibold text-text-primary">Group chat</h3>
          <p className="text-[11px] text-text-tertiary">
            Coordinate with everyone who&apos;s joined
          </p>
        </div>
        {!loading && messages.length > 0 && (
          <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium tabular-nums text-text-tertiary">
            {messages.length}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-96 space-y-1.5 overflow-y-auto bg-surface-muted/50 px-3 py-4"
      >
        {loading && (
          <div className="flex justify-center py-8">
            <Spinner size={16} />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-8 text-center text-caption text-text-tertiary">
            No messages yet.
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_id === userId;
          const name = msg.users?.persona_name ?? "Anonymous";
          const showName = !isMe && msg.user_id !== lastSender;
          lastSender = msg.user_id;

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}
            >
              {!isMe && (
                <div className={`${showName ? "" : "invisible"} shrink-0`}>
                  <Avatar name={name} size={24} />
                </div>
              )}
              <div className={`flex max-w-[78%] flex-col ${isMe ? "items-end" : "items-start"}`}>
                {showName && (
                  <p className="mb-0.5 ml-2 text-[10px] font-semibold text-text-tertiary">
                    {name}
                  </p>
                )}
                <div
                  className={`rounded-2xl px-3 py-2 text-body leading-snug ${
                    isMe
                      ? "rounded-br-md bg-amber/15 text-text-primary"
                      : "rounded-bl-md bg-surface-hover text-text-primary"
                  }`}
                >
                  <p className="break-words">{msg.message}</p>
                  <p className={`mt-0.5 text-[10px] tabular-nums ${isMe ? "text-amber/70" : "text-text-muted"}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isAuthenticated ? (
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 border-t border-border p-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message"
            maxLength={500}
            className="flex-1 rounded-full border border-border bg-transparent px-4 py-2 text-body text-text-primary placeholder:text-text-muted focus:border-text-tertiary focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-ink-950 transition-opacity disabled:opacity-40"
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
    </div>
  );
}

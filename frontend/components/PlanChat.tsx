"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import type { PlanMessage } from "@/lib/types";

interface PlanChatProps {
  planId: string;
}

export function PlanChat({ planId }: PlanChatProps) {
  const { isAuthenticated, userId } = useAuth();
  const [messages, setMessages] = useState<PlanMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getMessages(planId).then((data) => {
      setMessages(data.messages);
    }).catch(() => {});
  }, [planId]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${planId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plan_messages",
          filter: `plan_id=eq.${planId}`,
        },
        (payload) => {
          const newMsg = payload.new as PlanMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [planId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !isAuthenticated) return;

    setSending(true);
    try {
      const data = await api.sendMessage(planId, input.trim());
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
      setInput("");
    } catch {
      /* silent */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">Chat</h3>
        <p className="text-[11px] text-text-muted">Coordinate with your group here</p>
      </div>

      <div
        ref={containerRef}
        className="h-64 overflow-y-auto p-3 space-y-2 scrollbar-hide"
      >
        {messages.length === 0 && (
          <p className="text-xs text-text-muted text-center py-8">
            No messages yet. Say hi!
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_id === userId;
          const name = msg.users?.persona_name ?? "Anonymous";
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              <Avatar name={name} size={24} className="shrink-0 mt-0.5" />
              <div className={`max-w-[75%] ${isMe ? "text-right" : ""}`}>
                <p className="text-[10px] text-text-muted mb-0.5">{name}</p>
                <div className={`rounded-xl px-3 py-1.5 text-sm ${
                  isMe
                    ? "bg-amber/15 text-amber"
                    : "bg-navy-lighter text-text-primary"
                }`}>
                  {msg.message}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {isAuthenticated ? (
        <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-border">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
            className="flex-1 rounded-xl border border-border bg-navy-lighter px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-amber focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-amber-dark disabled:opacity-50"
          >
            Send
          </button>
        </form>
      ) : (
        <div className="p-3 border-t border-border text-center">
          <p className="text-xs text-text-muted">Sign in to chat</p>
        </div>
      )}
    </div>
  );
}

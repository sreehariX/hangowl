"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { PlanMessage } from "@/lib/types";

interface PlanChatProps {
  planId: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function PlanChat({ planId }: PlanChatProps) {
  const { isAuthenticated, userId } = useAuth();
  const [messages, setMessages] = useState<PlanMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const scrollToBottom = () => {
    const el = containerRef.current;
    if (el && shouldAutoScroll.current) {
      el.scrollTop = el.scrollHeight;
    }
  };

  useEffect(() => {
    api.getMessages(planId).then((data) => {
      setMessages(data.messages);
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      });
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
    scrollToBottom();
  }, [messages]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    shouldAutoScroll.current = atBottom;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !isAuthenticated) return;

    setSending(true);
    shouldAutoScroll.current = true;
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

  let lastSender = "";

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">Chat</h3>
        <p className="text-[11px] text-text-muted">Coordinate with your group here</p>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-72 overflow-y-auto px-3 py-3 space-y-1"
      >
        {messages.length === 0 && (
          <p className="text-xs text-text-muted text-center py-8">
            No messages yet. Say hi!
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_id === userId;
          const name = msg.users?.persona_name ?? "Anonymous";
          const showName = !isMe && msg.user_id !== lastSender;
          lastSender = msg.user_id;

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              {showName && (
                <p className="text-[10px] font-medium text-mid-blue-light ml-2 mb-0.5 mt-2">
                  {name}
                </p>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                isMe
                  ? "bg-amber/20 rounded-br-md"
                  : "bg-navy-lighter rounded-bl-md"
              }`}>
                {isMe && msg.user_id !== (messages[messages.indexOf(msg) - 1]?.user_id) && (
                  <p className="text-[10px] font-medium text-amber mb-0.5">You</p>
                )}
                <p className="text-sm text-text-primary break-words">{msg.message}</p>
                <p className={`text-[9px] mt-0.5 ${isMe ? "text-amber/50" : "text-text-muted/50"}`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {isAuthenticated ? (
        <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-border">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
            className="flex-1 rounded-full border border-border bg-navy-lighter px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-amber focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-full bg-amber h-9 w-9 flex items-center justify-center text-navy transition-colors hover:bg-amber-dark disabled:opacity-50 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
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

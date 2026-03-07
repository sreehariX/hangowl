"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ACTIVITY_EMOJI, type Plan } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";

function formatTimeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function formatDateIST(dateStr: string) {
  const now = new Date();
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const today = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const d = new Date(dateStr + "T00:00:00+05:30");
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dDate.getTime() === today.getTime()) return "Today";
  if (dDate.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
}

interface PlanCardProps {
  plan: Plan;
  onJoined?: () => void;
}

export function PlanCard({ plan, onJoined }: PlanCardProps) {
  const { isAuthenticated, userId } = useAuth();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  const memberCount = plan.plan_members?.[0]?.count ?? 0;
  const emoji = ACTIVITY_EMOJI[plan.activity] || "✨";
  const creatorName = plan.users?.persona_name ?? "Anonymous";
  const ended = new Date(plan.ends_at) < new Date();
  const spotsLeft = plan.max_people - memberCount;
  const isCreator = userId === plan.creator_id;

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAuthenticated) {
      router.push("/verify");
      return;
    }
    setJoining(true);
    setError("");
    try {
      await api.joinPlan(plan.id);
      setJoined(true);
      onJoined?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to join";
      if (msg.toLowerCase().includes("already")) {
        setJoined(true);
      } else {
        setError(msg);
      }
    } finally {
      setJoining(false);
    }
  };

  if (ended) return null;

  return (
    <Link
      href={`/plan/${plan.id}`}
      className="block group animate-slide-up rounded-2xl bg-surface border border-border p-4 transition-all hover:bg-surface-hover hover:border-border/80 hover:shadow-lg hover:shadow-black/10 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-lighter text-xl transition-transform group-hover:scale-110">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-text-primary truncate">
              {plan.activity}
            </h3>
            <span className="shrink-0 rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-medium text-amber">
              {formatDateIST(plan.plan_date)} &middot; {formatTimeIST(plan.starts_at)}-{formatTimeIST(plan.ends_at)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Avatar name={creatorName} size={16} />
            <p className="text-sm text-text-secondary truncate">
              {plan.location} &middot; {creatorName}
            </p>
          </div>
        </div>
      </div>

      {plan.description && (
        <p className="mt-2.5 text-sm text-text-secondary line-clamp-2">
          {plan.description}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            {memberCount}/{plan.max_people} joined
          </span>
          {spotsLeft <= 3 && spotsLeft > 0 && (
            <span className="text-xs font-medium text-error animate-pulse">
              {spotsLeft} spot{spotsLeft > 1 ? "s" : ""} left
            </span>
          )}
          <span className="text-[10px] text-text-muted/60">
            Tap for details
          </span>
        </div>
        {joined || isCreator ? (
          <span className="rounded-lg bg-success/15 border border-success/30 px-3 py-1.5 text-xs font-semibold text-success">
            Joined
          </span>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining || memberCount >= plan.max_people}
            className="rounded-lg bg-amber px-4 py-1.5 text-xs font-semibold text-navy transition-all hover:bg-amber-dark active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joining ? "..." : memberCount >= plan.max_people ? "Full" : "Join"}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-error">{error}</p>
      )}
    </Link>
  );
}

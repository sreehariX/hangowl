"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ACTIVITY_EMOJI, type Plan } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface PlanCardProps {
  plan: Plan;
  onJoined?: () => void;
}

export function PlanCard({ plan, onJoined }: PlanCardProps) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const memberCount = plan.plan_members?.[0]?.count ?? 0;
  const emoji = ACTIVITY_EMOJI[plan.activity] || "✨";
  const creatorName = plan.users?.persona_name ?? "Anonymous";
  const ended = new Date(plan.ends_at) < new Date();

  const handleJoin = async () => {
    if (!isAuthenticated) {
      router.push("/verify");
      return;
    }
    setJoining(true);
    setError("");
    try {
      await api.joinPlan(plan.id);
      onJoined?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  };

  if (ended) return null;

  return (
    <div className="animate-slide-up rounded-2xl bg-surface border border-border p-4 transition-colors hover:bg-surface-hover">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-lighter text-xl">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-text-primary truncate">
              {plan.activity}
            </h3>
            <span className="shrink-0 rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-medium text-amber">
              {formatDate(plan.plan_date)} &middot; {formatTime(plan.starts_at)}–{formatTime(plan.ends_at)}
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
        <span className="text-xs text-text-muted">
          {memberCount}/{plan.max_people} joined
        </span>
        <div className="flex gap-2">
          <Link
            href={`/plan/${plan.id}`}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Details
          </Link>
          <button
            onClick={handleJoin}
            disabled={joining || memberCount >= plan.max_people}
            className="rounded-lg bg-amber px-4 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-amber-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joining ? "..." : memberCount >= plan.max_people ? "Full" : "Join"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-error">{error}</p>
      )}
    </div>
  );
}

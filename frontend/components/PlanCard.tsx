"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { ACTIVITY_EMOJI, type Plan } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ProgressiveImage } from "@/components/ProgressiveImage";

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

const PlanCard = memo(function PlanCard({ plan, onJoined }: PlanCardProps) {
  const { isAuthenticated, userId } = useAuth();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  const memberCount = plan.plan_members?.[0]?.count ?? 0;
  const emoji = ACTIVITY_EMOJI[plan.activity] || "?";
  const creatorName = plan.users?.persona_name ?? "Anonymous";
  const ended = new Date(plan.ends_at) < new Date();
  const spotsLeft = plan.max_people - memberCount;
  const isCreator = userId === plan.creator_id;
  const isFull = spotsLeft <= 0;

  if (ended) return null;

  async function handleJoin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (joining || joined || isCreator || isFull || !isAuthenticated) return;
    setJoining(true);
    setError("");
    try {
      await api.joinPlan(plan.id);
      setJoined(true);
      onJoined?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      if (msg.includes("Already joined")) {
        setJoined(true);
      } else {
        setError(msg);
      }
    } finally {
      setJoining(false);
    }
  }

  const alreadyIn = isCreator || joined;

  return (
    <Link
      href={`/plan/${plan.id}`}
      className="block group rounded-2xl bg-surface border border-border overflow-hidden transition-all hover:bg-surface-hover hover:shadow-lg hover:shadow-black/10"
    >
      {plan.image_url && (
        <ProgressiveImage
          src={plan.image_url}
          className="w-full h-36 object-cover"
          skeletonClassName="w-full h-36"
        />
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-lighter text-xl shrink-0">
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[15px] text-text-primary truncate">{plan.activity}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Avatar name={creatorName} size={14} />
              <p className="text-xs text-text-muted truncate">{creatorName} &middot; {plan.location}</p>
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-medium text-amber bg-amber/10 rounded-full px-2 py-0.5">
            {formatDateIST(plan.plan_date)} {formatTimeIST(plan.starts_at)}
          </span>
        </div>

        {plan.description && (
          <p className="mt-2 text-sm text-text-secondary line-clamp-2">{plan.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted tabular-nums">{memberCount}/{plan.max_people} joined</span>
            {spotsLeft <= 3 && spotsLeft > 0 && (
              <span className="text-[11px] font-medium text-error">{spotsLeft} left</span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              <span className="tabular-nums">{plan.views_count ?? 0}</span>
            </span>
          </div>

          {isAuthenticated && (
            alreadyIn ? (
              <span className="rounded-full bg-success/15 px-3 py-1 text-[11px] font-semibold text-success">
                {isCreator ? "Your plan" : "Joined"}
              </span>
            ) : isFull ? (
              <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-text-muted">Full</span>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="rounded-full bg-amber px-4 py-1 text-[11px] font-bold text-navy transition-all hover:bg-amber-dark active:scale-95 disabled:opacity-50"
              >
                {joining ? "..." : "Join"}
              </button>
            )
          )}
        </div>

        {error && <p className="mt-1 text-[11px] text-error">{error}</p>}
      </div>
    </Link>
  );
});

export { PlanCard };

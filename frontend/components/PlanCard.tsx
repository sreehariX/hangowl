"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { ACTIVITY_EMOJI, type Plan } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import { Spinner } from "@/components/primitives";
import { BarChartIcon, CheckIcon, ClockIcon, MapPinIcon } from "@/components/icons";

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
  const emoji = ACTIVITY_EMOJI[plan.activity] || "✨";
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
      if (msg.includes("Already joined")) setJoined(true);
      else setError(msg);
    } finally {
      setJoining(false);
    }
  }

  const alreadyIn = isCreator || joined;

  return (
    <Link
      href={`/plan/${plan.id}`}
      className="surface-panel group block overflow-hidden transition-all duration-300 ease-[var(--ease-premium)] hover:-translate-y-0.5 hover:border-amber/30 hover:shadow-glass"
    >
      {plan.image_url && (
        <div className="relative">
          <ProgressiveImage
            src={plan.image_url}
            className="h-40 w-full object-cover transition-transform duration-500 ease-[var(--ease-premium)] group-hover:scale-[1.02]"
            skeletonClassName="h-40 w-full"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-950/60 to-transparent" />
          <div className="absolute left-3 top-3 flex items-center gap-1.5">
            <span className="badge-amber shadow-soft">
              <ClockIcon size={11} />
              {formatDateIST(plan.plan_date)} · {formatTimeIST(plan.starts_at)}
            </span>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-surface-raised to-surface-hover text-[22px] ring-1 ring-border/60">
            {emoji}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold tracking-tight text-text-primary">
              {plan.activity}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-caption text-text-tertiary">
              <Avatar name={creatorName} size={14} />
              <span className="truncate">{creatorName}</span>
              <span className="text-text-muted">·</span>
              <span className="inline-flex items-center gap-0.5 truncate">
                <MapPinIcon size={11} /> {plan.location}
              </span>
            </div>
          </div>
          {!plan.image_url && (
            <span className="badge-amber shrink-0">
              {formatDateIST(plan.plan_date)} · {formatTimeIST(plan.starts_at)}
            </span>
          )}
        </div>

        {plan.description && (
          <p className="mt-2.5 line-clamp-2 text-body text-text-secondary">
            {plan.description}
          </p>
        )}

        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-caption text-text-tertiary">
            <span className="tabular-nums">
              <span className="font-semibold text-text-secondary">
                {memberCount}
              </span>
              /{plan.max_people} joined
            </span>
            {spotsLeft <= 3 && spotsLeft > 0 && (
              <span className="font-semibold text-danger">
                {spotsLeft} left
              </span>
            )}
            <span className="flex items-center gap-1">
              <BarChartIcon size={12} />
              <span className="tabular-nums">{plan.views_count ?? 0}</span>
            </span>
          </div>

          {isAuthenticated &&
            (alreadyIn ? (
              <span className="badge-success">
                <CheckIcon size={11} />
                {isCreator ? "Your plan" : "Joined"}
              </span>
            ) : isFull ? (
              <span className="badge-muted">Full</span>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="btn-primary btn-xs px-4"
              >
                {joining ? <Spinner size={12} tone="ink" /> : "Join"}
              </button>
            ))}
        </div>

        {error && (
          <p className="mt-2 text-caption text-danger">{error}</p>
        )}
      </div>
    </Link>
  );
});

export { PlanCard };

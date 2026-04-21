"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { ACTIVITY_EMOJI, type Plan } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import { Spinner } from "@/components/primitives";
import { BarChartIcon, CheckIcon, ClockIcon, MapPinIcon, NavigationIcon } from "@/components/icons";
import { openDirections } from "@/lib/maps";

function formatTimeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
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
  const planCoords =
    typeof plan.latitude === "number" && typeof plan.longitude === "number"
      ? { lat: plan.latitude, lng: plan.longitude }
      : null;
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
      className="block overflow-hidden rounded-2xl border border-border transition-colors hover:bg-surface-hover/40"
    >
      {plan.image_url && (
        <div className="relative">
          <ProgressiveImage
            src={plan.image_url}
            className="h-40 w-full object-cover"
            skeletonClassName="h-40 w-full"
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[20px]">
            {emoji}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold text-text-primary">
              {plan.activity}
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-caption text-text-tertiary">
              <Avatar name={creatorName} size={14} />
              <span className="truncate">{creatorName}</span>
              <span className="text-text-muted">·</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openDirections(plan.location, planCoords);
                }}
                className="inline-flex items-center gap-0.5 truncate transition-colors hover:text-text-secondary"
                aria-label={`Directions to ${plan.location}`}
              >
                <MapPinIcon size={11} /> {plan.location}
                <NavigationIcon size={9} className="ml-0.5 text-text-muted" />
              </button>
            </div>
          </div>
          <span className="badge-amber shrink-0">
            <ClockIcon size={10} />
            {formatDateIST(plan.plan_date)} · {formatTimeIST(plan.starts_at)}
          </span>
        </div>

        {plan.description && (
          <p className="mt-2 line-clamp-2 text-body text-text-secondary">
            {plan.description}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-caption text-text-tertiary">
            <span className="tabular-nums">
              <span className="font-semibold text-text-secondary">{memberCount}</span>
              /{plan.max_people} joined
            </span>
            {spotsLeft <= 3 && spotsLeft > 0 && (
              <span className="font-semibold text-danger">{spotsLeft} left</span>
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

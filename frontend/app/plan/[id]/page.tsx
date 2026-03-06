"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ACTIVITY_EMOJI, type PlanDetail } from "@/lib/types";
import { Avatar } from "@/components/Avatar";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function PlanContent({ plan, onJoined }: { plan: PlanDetail; onJoined: () => void }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const emoji = ACTIVITY_EMOJI[plan.activity] || "✨";
  const creatorName = plan.users?.persona_name ?? "Anonymous";
  const members = plan.plan_members ?? [];
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
      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `${plan.activity} at ${plan.location} - HangOwl`,
        text: plan.description || `Join ${plan.activity} at ${plan.location}!`,
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 pt-8">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{emoji}</div>
          <h1 className="text-2xl font-bold text-text-primary">
            {plan.activity}
          </h1>
          <p className="text-text-secondary mt-1">{plan.location}</p>
        </div>

        {plan.description && (
          <p className="text-sm text-text-secondary text-center mb-6">
            {plan.description}
          </p>
        )}

        <div className="flex items-center justify-around mb-6 rounded-xl bg-navy-lighter p-3">
          <div className="text-center">
            <div className="text-sm font-bold text-amber">
              {plan.plan_date ? formatDate(plan.plan_date) : ""}
            </div>
            <div className="text-xs text-text-muted">
              {formatTime(plan.starts_at)} – {formatTime(plan.ends_at)}
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="text-lg font-bold text-mid-blue-light">
              {members.length}/{plan.max_people}
            </div>
            <div className="text-xs text-text-muted">joined</div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs text-text-muted mb-2">Created by</p>
          <div className="flex items-center gap-2">
            <Avatar name={creatorName} size={28} />
            <p className="text-sm font-medium text-text-primary">{creatorName}</p>
          </div>
        </div>

        {members.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-text-muted mb-2">
              People in ({members.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((m, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 rounded-full bg-navy-lighter px-2 py-1 text-xs text-text-secondary"
                >
                  <Avatar name={m.users?.persona_name ?? "?"} size={18} />
                  {m.users?.persona_name ?? "?"}
                </span>
              ))}
            </div>
          </div>
        )}

        {!ended && (
          <div className="space-y-2">
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full rounded-xl bg-amber py-3 font-semibold text-navy transition-colors hover:bg-amber-dark disabled:opacity-50"
            >
              {joining
                ? "Joining..."
                : isAuthenticated
                  ? "Join This Plan"
                  : "Login to Join"}
            </button>
            <button
              onClick={handleShare}
              className="w-full rounded-xl border border-border py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            >
              Share
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-center text-sm text-error">{error}</p>
        )}

        {ended && (
          <div className="rounded-xl bg-error/10 p-3 text-center">
            <p className="text-sm font-medium text-error">This plan has ended</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlanPage() {
  const params = useParams();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPlan = useCallback(async () => {
    try {
      const data = await api.getPlan(params.id as string);
      setPlan(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan not found");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  if (loading) {
    return (
      <div className="mx-auto max-w-sm px-4 pt-8">
        <div className="rounded-2xl bg-surface p-6 space-y-4">
          <div className="skeleton h-12 w-12 mx-auto rounded-xl" />
          <div className="skeleton h-6 w-32 mx-auto" />
          <div className="skeleton h-4 w-24 mx-auto" />
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="mx-auto max-w-sm px-4 pt-20 text-center">
        <div className="text-4xl mb-4">🦉</div>
        <h1 className="text-xl font-bold text-text-primary mb-2">
          Plan not found
        </h1>
        <p className="text-sm text-text-secondary">{error}</p>
      </div>
    );
  }

  return <PlanContent plan={plan} onJoined={fetchPlan} />;
}

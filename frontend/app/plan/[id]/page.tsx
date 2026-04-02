"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ACTIVITY_EMOJI, type PlanDetail } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { PlanChat } from "@/components/PlanChat";

function formatTimeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function formatDateIST(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+05:30");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function PlanContent({ plan, onRefresh }: { plan: PlanDetail; onRefresh: () => void }) {
  const { isAuthenticated, userId } = useAuth();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const emoji = ACTIVITY_EMOJI[plan.activity] || "✨";
  const creatorName = plan.users?.persona_name ?? "Anonymous";
  const members = plan.plan_members ?? [];
  const ended = new Date(plan.ends_at) < new Date();
  const isCreator = userId === plan.creator_id;
  const alreadyJoined = members.some((m) => m.user_id === userId);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      router.push("/verify");
      return;
    }
    setJoining(true);
    setError("");
    try {
      await api.joinPlan(plan.id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    setError("");
    try {
      await api.leavePlan(plan.id);
      setConfirmLeave(false);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave");
    } finally {
      setLeaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.hidePlan(plan.id);
      router.push("/hangouts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleShare = async () => {
    const time = `${formatTimeIST(plan.starts_at)} - ${formatTimeIST(plan.ends_at)}`;
    const text = `${plan.activity} at ${plan.location} (${time} IST)${plan.description ? ` - "${plan.description}"` : ""}. Join on HangOwl:`;

    if (navigator.share) {
      await navigator.share({
        title: `${plan.activity} at ${plan.location} - HangOwl`,
        text,
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 pt-8 pb-24 space-y-4">
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
              {plan.plan_date ? formatDateIST(plan.plan_date) : ""}
            </div>
            <div className="text-xs text-text-muted">
              {formatTimeIST(plan.starts_at)} - {formatTimeIST(plan.ends_at)} IST
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="text-lg font-bold text-mid-blue-light">
              {members.length}/{plan.max_people}
            </div>
            <div className="text-xs text-text-muted">joined</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="text-lg font-bold text-text-secondary">
              {(plan.views_count ?? 0) >= 1000
                ? `${((plan.views_count ?? 0) / 1000).toFixed((plan.views_count ?? 0) < 10000 ? 1 : 0)}K`
                : (plan.views_count ?? 0)}
            </div>
            <div className="text-xs text-text-muted">views</div>
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
              disabled={joining || alreadyJoined}
              className={`w-full rounded-xl py-3 font-semibold transition-all active:scale-[0.98] ${
                alreadyJoined
                  ? "bg-success/15 text-success border border-success/30 cursor-default"
                  : "bg-amber text-navy hover:bg-amber-dark disabled:opacity-50"
              }`}
            >
              {joining
                ? "Joining..."
                : alreadyJoined && isCreator
                  ? "You created this plan"
                  : alreadyJoined
                    ? "You're in this plan"
                    : isAuthenticated
                      ? "Join This Plan"
                      : "Login to Join"}
            </button>
            <button
              onClick={handleShare}
              className="w-full rounded-xl border border-border py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            >
              Share with friends
            </button>
            {alreadyJoined && !isCreator && !confirmLeave && (
              <button
                onClick={() => setConfirmLeave(true)}
                className="w-full rounded-xl border border-border py-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-hover"
              >
                Leave this plan
              </button>
            )}
            {alreadyJoined && !isCreator && confirmLeave && (
              <div className="rounded-xl border border-border p-3 space-y-2">
                <p className="text-xs text-text-secondary text-center">
                  Are you sure you want to leave this plan?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmLeave(false)}
                    className="flex-1 rounded-lg border border-border py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLeave}
                    disabled={leaving}
                    className="flex-1 rounded-lg bg-error py-2 text-sm font-medium text-white transition-colors hover:bg-error/80 disabled:opacity-50"
                  >
                    {leaving ? "Leaving..." : "Yes, leave"}
                  </button>
                </div>
              </div>
            )}
            {isCreator && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full rounded-xl border border-error/30 py-3 text-sm font-medium text-error transition-colors hover:bg-error/10"
              >
                Delete this plan
              </button>
            )}
            {isCreator && confirmDelete && (
              <div className="rounded-xl border border-error/30 p-3 space-y-2">
                <p className="text-xs text-text-secondary text-center">
                  This will remove the plan from the board. Are you sure?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-lg border border-border py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 rounded-lg bg-error py-2 text-sm font-medium text-white transition-colors hover:bg-error/80 disabled:opacity-50"
                  >
                    {deleting ? "Removing..." : "Yes, delete"}
                  </button>
                </div>
              </div>
            )}
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

      <PlanChat planId={plan.id} />
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
    // Record view only once per session per plan (persists through same-tab refreshes)
    const planId = params.id as string;
    try {
      const raw = sessionStorage.getItem("ho_viewed_plans");
      const viewed: string[] = raw ? JSON.parse(raw) : [];
      if (!viewed.includes(planId)) {
        viewed.push(planId);
        if (viewed.length > 200) viewed.splice(0, viewed.length - 200);
        sessionStorage.setItem("ho_viewed_plans", JSON.stringify(viewed));
        api.recordPlanView(planId).catch(() => {});
      }
    } catch {
      api.recordPlanView(planId).catch(() => {});
    }
  }, [fetchPlan, params.id]);

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

  return <PlanContent plan={plan} onRefresh={fetchPlan} />;
}

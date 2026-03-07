"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { PlanCard } from "@/components/PlanCard";
import { PlanListSkeleton } from "@/components/Skeleton";
import { ACTIVITY_EMOJI, type Plan } from "@/lib/types";
import Link from "next/link";

function formatTimeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+05:30");
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
}

function PastPlanCard({ plan }: { plan: Plan }) {
  const emoji = ACTIVITY_EMOJI[plan.activity] || "✨";
  const memberCount = plan.plan_members?.[0]?.count ?? 0;

  return (
    <Link
      href={`/plan/${plan.id}`}
      className="block rounded-xl border border-border bg-surface/50 p-3 transition-colors hover:bg-surface-hover"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{plan.activity}</p>
          <p className="text-xs text-text-muted truncate">
            {plan.location} &middot; {formatDateShort(plan.plan_date)} &middot; {formatTimeIST(plan.starts_at)}
          </p>
        </div>
        <span className="text-xs text-text-muted">{memberCount} joined</span>
      </div>
    </Link>
  );
}

export default function MyPlansPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [live, setLive] = useState<Plan[]>([]);
  const [past, setPast] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const fetchMyPlans = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const data = await api.getMyPlans();
      setLive(data.live);
      setPast(data.past);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/verify");
      return;
    }
    fetchMyPlans();
  }, [authLoading, isAuthenticated, router, fetchMyPlans]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-20 md:pt-6">
        <PlanListSkeleton count={3} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-20 pb-24 md:pt-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">My Plans</h1>
        <p className="text-xs text-text-muted mt-0.5">
          Plans you created or joined
        </p>
      </div>

      {loading ? (
        <PlanListSkeleton count={3} />
      ) : fetchError ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-error mb-3">{fetchError}</p>
          <button
            onClick={fetchMyPlans}
            className="rounded-xl bg-amber px-5 py-2 text-sm font-semibold text-navy hover:bg-amber-dark"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-text-secondary mb-3">
              Live now ({live.length})
            </h2>
            {live.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-6 text-center">
                <p className="text-sm text-text-muted mb-3">No live plans right now</p>
                <Link
                  href="/free"
                  className="inline-block rounded-xl bg-amber px-5 py-2 text-sm font-semibold text-navy hover:bg-amber-dark"
                >
                  Create a Plan
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {live.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} onJoined={fetchMyPlans} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-text-secondary mb-3">
              Past ({past.length})
            </h2>
            {past.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No past plans yet</p>
            ) : (
              <div className="space-y-2">
                {past.map((plan) => (
                  <PastPlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { PlanCard } from "@/components/PlanCard";
import { PlanListSkeleton } from "@/components/Skeleton";
import { ACTIVITIES, LOCATIONS, type Plan } from "@/lib/types";

type FilterActivity = string | "all";
type FilterLocation = string | "all";

export default function BoardPage() {
  const { isAuthenticated, personaName, loading: authLoading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filterActivity, setFilterActivity] = useState<FilterActivity>("all");
  const [filterLocation, setFilterLocation] = useState<FilterLocation>("all");

  const fetchPlans = useCallback(async () => {
    try {
      const params: { location?: string; activity?: string } = {};
      if (filterActivity !== "all") params.activity = filterActivity;
      if (filterLocation !== "all") params.location = filterLocation;
      const [plansData, idsData] = await Promise.all([
        api.getPlans(params),
        isAuthenticated ? api.getMyPlanIds() : Promise.resolve({ plan_ids: [] }),
      ]);
      setPlans(plansData.plans);
      setJoinedIds(new Set(idsData.plan_ids));
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [filterActivity, filterLocation, isAuthenticated]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/verify");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    fetchPlans();
    const interval = setInterval(fetchPlans, 15000);
    return () => clearInterval(interval);
  }, [fetchPlans]);

  useEffect(() => {
    const channel = supabase
      .channel("plans-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plans" },
        () => fetchPlans()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_members" },
        () => fetchPlans()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPlans]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-8">
        <PlanListSkeleton count={5} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-20 pb-24 md:pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">The Board</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {personaName} &middot; {plans.length} active plan{plans.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/free"
          className="rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-amber-dark"
        >
          + New Plan
        </Link>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilterActivity("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterActivity === "all"
                ? "bg-amber text-navy"
                : "bg-surface text-text-secondary hover:text-text-primary"
            }`}
          >
            All Activities
          </button>
          {ACTIVITIES.map((a) => (
            <button
              key={a.label}
              onClick={() => setFilterActivity(a.label)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filterActivity === a.label
                  ? "bg-amber text-navy"
                  : "bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              {a.emoji} {a.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilterLocation("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterLocation === "all"
                ? "bg-mid-blue text-white"
                : "bg-surface text-text-secondary hover:text-text-primary"
            }`}
          >
            All Locations
          </button>
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => setFilterLocation(loc)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filterLocation === loc
                  ? "bg-mid-blue text-white"
                  : "bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <PlanListSkeleton count={5} />
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-3xl mb-3">🌙</div>
          <p className="text-text-secondary text-sm mb-4">
            No plans match your filters. Try a different filter or create one.
          </p>
          <Link
            href="/free"
            className="inline-block rounded-xl bg-amber px-6 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-amber-dark"
          >
            Create a Plan
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isJoined={joinedIds.has(plan.id)}
              onJoined={fetchPlans}
            />
          ))}
        </div>
      )}
    </div>
  );
}

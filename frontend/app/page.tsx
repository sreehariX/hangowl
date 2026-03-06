"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PlanCard } from "@/components/PlanCard";
import { PlanListSkeleton, StatSkeleton } from "@/components/Skeleton";
import type { Plan, Stats } from "@/lib/types";

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch {
      /* silent */
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await api.getPlans();
      setPlans(data.plans);
    } catch {
      /* silent */
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchPlans();
    const statsInterval = setInterval(fetchStats, 30000);
    const plansInterval = setInterval(fetchPlans, 15000);
    return () => {
      clearInterval(statsInterval);
      clearInterval(plansInterval);
    };
  }, [fetchStats, fetchPlans]);

  return (
    <div className="mx-auto max-w-lg px-4 pt-10 md:pt-16">
      <section className="text-center space-y-4 mb-10">
        <div className="text-5xl">🦉</div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
          Who&apos;s free at IIT-B
          <br />
          <span className="text-amber">right now?</span>
        </h1>
        <p className="text-text-secondary text-sm max-w-xs mx-auto leading-relaxed">
          Anonymous campus hangout board. Make plans, join vibes, stay invisible.
        </p>

        <div className="flex items-center justify-center gap-6 pt-2">
          {loadingStats ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber animate-pulse-glow">
                  {stats?.free_now ?? 0}
                </div>
                <div className="text-xs text-text-muted mt-1">people free</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-3xl font-bold text-mid-blue-light">
                  {stats?.active_plans ?? 0}
                </div>
                <div className="text-xs text-text-muted mt-1">active plans</div>
              </div>
            </>
          )}
        </div>

        <div className="pt-4 space-y-3">
          <Link
            href="/verify"
            className="block w-full rounded-xl bg-amber py-3.5 text-center font-semibold text-navy transition-colors hover:bg-amber-dark"
          >
            Join the network
          </Link>
          <p className="text-xs text-text-muted">
            We can&apos;t identify you even if we wanted to.
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Live Plans
          </h2>
          <span className="text-xs text-text-muted">
            auto-refreshes every 15s
          </span>
        </div>

        {loadingPlans ? (
          <PlanListSkeleton count={3} />
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <div className="text-3xl mb-3">🌙</div>
            <p className="text-text-secondary text-sm">
              No active plans right now. Be the first!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.slice(0, 10).map((plan) => (
              <PlanCard key={plan.id} plan={plan} onJoined={fetchPlans} />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-12 pb-8 text-center text-xs text-text-muted">
        HangOwl &middot; Built for IIT Bombay
      </footer>
    </div>
  );
}

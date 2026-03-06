"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { PlanCard } from "@/components/PlanCard";
import { PlanListSkeleton } from "@/components/Skeleton";
import type { Plan, Stats } from "@/lib/types";

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 1200;
    const start = Date.now();
    const from = display;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return <>{display}</>;
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
    </span>
  );
}

export default function HomePage() {
  const { isAuthenticated, personaName } = useAuth();
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

  useEffect(() => {
    if (!isAuthenticated) return;
    api.heartbeat().catch(() => {});
    const hb = setInterval(() => api.heartbeat().catch(() => {}), 60000);
    return () => clearInterval(hb);
  }, [isAuthenticated]);

  return (
    <div className="mx-auto max-w-lg px-4 pt-10 pb-24 md:pt-16">
      <section className="text-center space-y-4 mb-10">
        <div className="text-5xl animate-float">🦉</div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
          Find people to hang out
          <br />
          <span className="text-amber">with at IIT Bombay</span>
        </h1>
        <p className="text-text-secondary text-sm max-w-sm mx-auto leading-relaxed">
        Post what you want to do. Other students can see it and join, or you can join their plans. Stay anonymous to everyone on the app.
        </p>

        {loadingStats ? (
          <div className="flex justify-center gap-4 pt-4">
            <div className="skeleton h-28 w-28 rounded-2xl" />
            <div className="skeleton h-28 w-28 rounded-2xl" />
            <div className="skeleton h-28 w-28 rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 pt-4">
            <div className="animate-scale-in stagger-1 relative overflow-hidden rounded-2xl border border-amber/20 bg-gradient-to-br from-amber/10 to-amber/5 p-4">
              <div className="text-3xl font-black text-amber tabular-nums">
                <AnimatedNumber value={stats?.total_users ?? 0} />
              </div>
              <div className="text-[11px] font-medium text-amber/70 mt-1 uppercase tracking-wider">
                Total Students
              </div>
            </div>
            <div className="animate-scale-in stagger-2 relative overflow-hidden rounded-2xl border border-success/20 bg-gradient-to-br from-success/10 to-success/5 p-4">
              <div className="flex items-center justify-center gap-1.5">
                <LiveDot />
                <span className="text-3xl font-black text-success tabular-nums">
                  <AnimatedNumber value={stats?.free_now ?? 0} />
                </span>
              </div>
              <div className="text-[11px] font-medium text-success/70 mt-1 uppercase tracking-wider">
                Online now
              </div>
            </div>
            <div className="animate-scale-in stagger-3 relative overflow-hidden rounded-2xl border border-mid-blue/20 bg-gradient-to-br from-mid-blue/10 to-mid-blue/5 p-4">
              <div className="text-3xl font-black text-mid-blue-light tabular-nums">
                <AnimatedNumber value={stats?.active_plans ?? 0} />
              </div>
              <div className="text-[11px] font-medium text-mid-blue-light/70 mt-1 uppercase tracking-wider">
                Live plans
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 space-y-3">
          {isAuthenticated ? (
            <Link
              href="/board"
              className="flex items-center justify-center gap-3 w-full rounded-xl bg-surface border border-border py-3.5 transition-all hover:bg-surface-hover active:scale-[0.98]"
            >
              <Avatar name={personaName || ""} size={28} />
              <span className="font-semibold text-text-primary">{personaName}</span>
              <span className="text-text-muted text-sm ml-1">&rarr;</span>
            </Link>
          ) : (
            <>
              <Link
                href="/verify"
                className="block w-full rounded-xl bg-amber py-3.5 text-center font-semibold text-navy transition-all hover:bg-amber-dark active:scale-[0.98]"
              >
                Join with IIT-B email
              </Link>
              <p className="text-xs text-text-muted">
                No signup. No password. Just a one-time code to your inbox.
              </p>
            </>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">
              Happening now
            </h2>
            <LiveDot />
          </div>
        </div>

        {loadingPlans ? (
          <PlanListSkeleton count={3} />
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <div className="text-3xl mb-3">🌙</div>
            <p className="text-text-secondary text-sm">
              No plans right now. Be the first to post one!
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

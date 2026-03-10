"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PlanCard } from "@/components/PlanCard";
import { PlanListSkeleton } from "@/components/Skeleton";
import type { Plan, Stats } from "@/lib/types";

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
    </span>
  );
}

export default function HomePage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadStats() {
      try {
        const data = await api.getStats();
        if (active) setStats(data);
      } catch { /* silent */ }
    }
    async function loadPlans() {
      try {
        const data = await api.getPlans();
        if (active) setPlans(data.plans);
      } catch { /* silent */ }
      if (active) setLoadingPlans(false);
    }
    loadStats();
    loadPlans();
    const si = setInterval(loadStats, 30000);
    const pi = setInterval(loadPlans, 15000);
    return () => { active = false; clearInterval(si); clearInterval(pi); };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.heartbeat().catch(() => {});
    const hb = setInterval(() => api.heartbeat().catch(() => {}), 60000);
    return () => clearInterval(hb);
  }, [isAuthenticated]);

  return (
    <div className="mx-auto max-w-lg px-4 pt-10 pb-24 md:pt-16 relative">
      {stats && (
        <div className="fixed top-0 left-0 z-50 p-3 md:p-4">
          <div className="flex items-center gap-2.5 rounded-full border border-border bg-navy-light/90 backdrop-blur-sm px-3 py-1.5 text-[11px] font-medium">
            <span className="flex items-center gap-1 text-success tabular-nums">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              {stats.free_now} online
            </span>
            <span className="w-px h-3 bg-border" />
            <span className="text-amber tabular-nums">{stats.total_users} students</span>
          </div>
        </div>
      )}

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

        {!authLoading && !isAuthenticated && (
          <div className="pt-4 space-y-3">
            <Link
              href="/verify"
              className="block w-full rounded-xl bg-amber py-3.5 text-center font-semibold text-navy transition-all hover:bg-amber-dark active:scale-[0.98]"
            >
              Join with IIT-B email
            </Link>
            <p className="text-xs text-text-muted">
              No signup. No password. Just a one-time code to your inbox.
            </p>
          </div>
        )}
      </section>

      <div className="rounded-xl border border-amber/20 bg-amber/5 px-4 py-3 mb-6">
        <p className="text-xs text-text-secondary leading-relaxed">
          We are new! 50+ students across BTech, MTech, MBA, PhD and more have already joined. It will take some time to reach enough people so plans keep going. Until then, be the first one to start a plan!
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">
              Happening now
            </h2>
            <LiveDot />
          </div>
          {stats && (
            <span className="text-xs font-medium text-mid-blue-light tabular-nums">
              {stats.active_plans} live plan{stats.active_plans !== 1 ? "s" : ""}
            </span>
          )}
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
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-12 pb-8 text-center text-xs text-text-muted">
        HangOwl &middot; Built for IIT Bombay students
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/hooks";
import { EmptyState, SectionHeading, Spinner } from "@/components/primitives";
import { BarChartIcon } from "@/components/icons";
import type { AdminMetrics } from "@/lib/types";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p>
      )}
    </div>
  );
}

function MetricSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 pb-6 pt-2">
      <SectionHeading>{title}</SectionHeading>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
    </section>
  );
}

export default function AdminMetricsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/verify");
      return;
    }
    if (isAdmin === false) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (isAdmin !== true) return;
    let active = true;
    (async () => {
      try {
        const data = await api.getAdminMetrics();
        if (active) setMetrics(data);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  if (authLoading || isAdmin === null) {
    return (
      <div className="app-shell pt-10">
        <div className="flex justify-center">
          <Spinner />
        </div>
      </div>
    );
  }

  if (isAdmin !== true) return null;

  return (
    <div className="app-shell pt-0">
      <div className="app-content">
        <header className="top-bar">
          <BarChartIcon size={18} className="text-amber" />
          <h1 className="text-[17px] font-semibold text-text-primary">Metrics</h1>
          {metrics && (
            <span className="ml-auto text-[11px] text-text-tertiary">
              Updated{" "}
              {new Date(metrics.generated_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState
            title="Couldn't load metrics"
            description={error}
            action={
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary"
              >
                Retry
              </button>
            }
          />
        ) : metrics ? (
          <>
            <p className="px-4 pb-2 pt-4 text-caption text-text-tertiary">
              Focus on growth — registrations, active users, and on-platform
              activity. Revenue, NPS, and cohort retention are intentionally
              skipped until they make sense for HangOwl.
            </p>

            <MetricSection title="Total registrations">
              <StatCard
                label="All-time"
                value={metrics.registrations.total.toLocaleString()}
              />
              <StatCard
                label="Today"
                value={metrics.registrations.new_today.toLocaleString()}
              />
              <StatCard
                label="Last 7d"
                value={metrics.registrations.new_this_week.toLocaleString()}
              />
              <StatCard
                label="Last 30d"
                value={metrics.registrations.new_this_month.toLocaleString()}
              />
            </MetricSection>

            <MetricSection title="Active users">
              <StatCard
                label="Online now"
                value={metrics.active_users.online_now.toLocaleString()}
                hint="Active in last 5 min"
              />
              <StatCard
                label="DAU"
                value={metrics.active_users.dau.toLocaleString()}
                hint="Active in last 24h"
              />
              <StatCard
                label="WAU"
                value={metrics.active_users.wau.toLocaleString()}
                hint="Active in last 7d"
              />
              <StatCard
                label="MAU"
                value={metrics.active_users.mau.toLocaleString()}
                hint="Active in last 30d"
              />
            </MetricSection>

            <MetricSection title="Activity levels">
              <StatCard
                label="Stickiness (DAU/MAU)"
                value={`${metrics.active_users.dau_over_mau_pct}%`}
                hint="Higher = more habitual"
              />
              <StatCard
                label="WAU/MAU"
                value={`${metrics.active_users.wau_over_mau_pct}%`}
              />
              <StatCard
                label="Posts today"
                value={metrics.activity.posts_today.toLocaleString()}
                hint={`${metrics.activity.posts_total.toLocaleString()} all-time`}
              />
              <StatCard
                label="Posts last 7d"
                value={metrics.activity.posts_this_week.toLocaleString()}
              />
              <StatCard
                label="Likes today"
                value={metrics.activity.likes_today.toLocaleString()}
                hint={`${metrics.activity.likes_total.toLocaleString()} all-time`}
              />
              <StatCard
                label="Plans today"
                value={metrics.activity.plans_today.toLocaleString()}
                hint={`${metrics.activity.plans_total.toLocaleString()} all-time`}
              />
              <StatCard
                label="Active plans now"
                value={metrics.activity.plans_active_now.toLocaleString()}
              />
              <StatCard
                label="Plan joins (7d)"
                value={metrics.activity.plan_joins_this_week.toLocaleString()}
                hint={`${metrics.activity.plan_joins_total.toLocaleString()} all-time`}
              />
            </MetricSection>
          </>
        ) : null}
      </div>
    </div>
  );
}

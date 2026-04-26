"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/hooks";
import { EmptyState, SectionHeading, Spinner } from "@/components/primitives";
import { MetricsChart } from "@/components/MetricsChart";
import { BarChartIcon } from "@/components/icons";
import type { AdminMetrics, AdminMetricsTimeseries } from "@/lib/types";

const RANGE_OPTIONS = [7, 14, 30] as const;
type Range = (typeof RANGE_OPTIONS)[number];

const AUTO_REFRESH_MS = 60_000; // 1 minute

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
      {hint && <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p>}
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

function RefreshIcon({ size = 14, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={spinning ? "animate-spin" : undefined}
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export default function AdminMetricsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [series, setSeries] = useState<AdminMetricsTimeseries | null>(null);
  const [range, setRange] = useState<Range>(14);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const inflightRef = useRef(false);

  const load = useCallback(
    async (
      opts: { mode?: "initial" | "refresh"; rangeOverride?: Range } = {},
    ) => {
      const mode = opts.mode ?? "refresh";
      const r = opts.rangeOverride ?? range;
      if (inflightRef.current) return;
      inflightRef.current = true;
      if (mode === "refresh") setRefreshing(true);
      try {
        const [m, s] = await Promise.all([
          api.getAdminMetrics(),
          api.getAdminMetricsTimeseries(r),
        ]);
        setMetrics(m);
        setSeries(s);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        inflightRef.current = false;
        if (mode === "initial") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [range],
  );

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
    void load({ mode: "initial" });
  }, [isAdmin, load]);

  // Auto-refresh on a fixed interval and when the tab regains focus, so the
  // dashboard stays current without the user mashing Refresh. Skipped while
  // the tab is hidden (no point burning quota when nobody's watching).
  useEffect(() => {
    if (isAdmin !== true || !autoRefresh) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      if (document.hidden) return;
      void load({ mode: "refresh" });
    };
    id = setInterval(tick, AUTO_REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) void load({ mode: "refresh" });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (id) clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAdmin, autoRefresh, load]);

  function handleRangeChange(r: Range) {
    setRange(r);
    if (isAdmin === true) void load({ mode: "refresh", rangeOverride: r });
  }

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
          <div className="ml-auto flex items-center gap-2">
            {lastUpdated && (
              <span className="hidden text-[11px] text-text-tertiary sm:inline">
                Updated{" "}
                {lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <label className="hidden items-center gap-1.5 text-[11px] text-text-tertiary sm:flex">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-3 w-3 accent-amber"
                aria-label="Auto-refresh every minute"
              />
              Auto
            </label>
            <button
              type="button"
              onClick={() => void load({ mode: "refresh" })}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-hover px-3 py-1 text-[12px] font-medium text-text-primary transition-colors hover:bg-surface-hover/80 disabled:opacity-60"
              aria-label="Refresh metrics"
            >
              <RefreshIcon spinning={refreshing} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error && !metrics ? (
          <EmptyState
            title="Couldn't load metrics"
            description={error}
            action={
              <button
                onClick={() => void load({ mode: "initial" })}
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

            <section className="px-4 pb-10 pt-2">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="section-eyebrow">Trends</h2>
                <div
                  role="tablist"
                  aria-label="Time range"
                  className="inline-flex overflow-hidden rounded-full border border-border bg-surface-hover/40 text-[11px]"
                >
                  {RANGE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      role="tab"
                      aria-selected={range === r}
                      onClick={() => handleRangeChange(r)}
                      className={`px-3 py-1 font-medium transition-colors ${
                        range === r
                          ? "bg-amber text-ink-950"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {r}d
                    </button>
                  ))}
                </div>
              </div>

              {series ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <MetricsChart
                    name="New registrations"
                    labels={series.labels}
                    values={series.series.registrations}
                    color="#F6BA3D"
                  />
                  <MetricsChart
                    name="Active users"
                    labels={series.labels}
                    values={series.series.active_users}
                    color="#34D99F"
                  />
                  <MetricsChart
                    name="Posts"
                    labels={series.labels}
                    values={series.series.posts}
                    color="#7BB7FF"
                  />
                  <MetricsChart
                    name="Plans"
                    labels={series.labels}
                    values={series.series.plans}
                    color="#E879F9"
                  />
                </div>
              ) : (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

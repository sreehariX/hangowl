"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/hooks";
import { EmptyState, Spinner } from "@/components/primitives";
import { MetricsChart } from "@/components/MetricsChart";
import type { AdminMetrics, AdminMetricsTimeseries } from "@/lib/types";

const RANGE_OPTIONS = [7, 14, 30] as const;
type Range = (typeof RANGE_OPTIONS)[number];

const AUTO_REFRESH_MS = 60_000;

const SERIES_COLORS = {
  registrations: "#F6BA3D", // amber — primary brand
  active_users: "#34D99F",  // emerald — health
  posts: "#7BB7FF",         // sky    — engagement
  plans: "#E879F9",         // fuchsia — meetups
} as const;

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

/**
 * "Right now" KPI tile. Big number, small label. Designed to be glanceable
 * — these four are the only stat-as-text tiles on the page; everything
 * else lives in the trend charts so we don't repeat the same number in
 * three different boxes.
 */
function KPI({
  label,
  value,
  hint,
  accent,
  pulse,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  pulse?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-surface to-surface/60 p-4">
      {accent && (
        <span
          aria-hidden
          className="absolute inset-x-4 top-0 h-px"
          style={{
            background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
          }}
        />
      )}
      <div className="flex items-center gap-2">
        {pulse && (
          <span aria-hidden className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full animate-pulse rounded-full opacity-70"
              style={{ background: accent ?? "#34D99F" }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: accent ?? "#34D99F" }}
            />
          </span>
        )}
        <p className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-text-primary">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-text-tertiary">{hint}</p>}
    </div>
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
    if (isAdmin === false) router.replace("/");
  }, [authLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (isAdmin !== true) return;
    void load({ mode: "initial" });
  }, [isAdmin, load]);

  useEffect(() => {
    if (isAdmin !== true || !autoRefresh) return;
    const tick = () => {
      if (document.hidden) return;
      void load({ mode: "refresh" });
    };
    const id = setInterval(tick, AUTO_REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) void load({ mode: "refresh" });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
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

  const stickiness = metrics?.active_users.dau_over_mau_pct ?? 0;
  const rangeLabel = `Last ${range} days`;
  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="app-shell pt-0">
      <div className="app-content">
        {/* Page header — premium minimal: title, ambient pulse, controls */}
        <header className="border-b border-border px-4 pb-4 pt-5 md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber">
                Admin
              </p>
              <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-text-primary md:text-[28px]">
                Dashboard
              </h1>
              <p className="mt-1 text-[12px] text-text-tertiary">
                Growth and engagement at a glance · {rangeLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                role="tablist"
                aria-label="Time range"
                className="inline-flex overflow-hidden rounded-full border border-border bg-surface-hover/40 p-0.5 text-[11px]"
              >
                {RANGE_OPTIONS.map((r) => (
                  <button
                    key={r}
                    role="tab"
                    aria-selected={range === r}
                    onClick={() => handleRangeChange(r)}
                    className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                      range === r
                        ? "bg-amber text-ink-950 shadow-[0_0_0_1px_rgba(246,186,61,0.4)]"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {r}d
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void load({ mode: "refresh" })}
                disabled={refreshing}
                aria-label="Refresh metrics"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-hover/60 px-3 py-1 text-[12px] font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-60"
              >
                <RefreshIcon spinning={refreshing} />
                <span className="hidden sm:inline">
                  {refreshing ? "Refreshing" : "Refresh"}
                </span>
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-tertiary">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Live · updated {updatedLabel}
            </span>
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-3 w-3 accent-amber"
                aria-label="Auto-refresh every minute"
              />
              Auto-refresh
            </label>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
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
            {/* Right-now KPI strip — only the four numbers that change in
                real time and that no chart already shows. Everything else
                (today, 7d, 30d totals) is now embedded in the chart cards
                below as headline + delta. */}
            <section className="grid grid-cols-2 gap-3 px-4 pt-5 md:grid-cols-4 md:px-6">
              <KPI
                label="Online now"
                value={metrics.active_users.online_now.toLocaleString()}
                hint="Active in last 5 min"
                accent="#34D99F"
                pulse
              />
              <KPI
                label="Total members"
                value={metrics.registrations.total.toLocaleString()}
                hint="All-time registrations"
                accent="#F6BA3D"
              />
              <KPI
                label="Stickiness"
                value={`${stickiness}%`}
                hint="DAU ÷ MAU"
                accent="#7BB7FF"
              />
              <KPI
                label="Active plans"
                value={metrics.activity.plans_active_now.toLocaleString()}
                hint="Hangouts happening now"
                accent="#E879F9"
              />
            </section>

            {/* Trends — four chart cards. Each card is self-describing
                (headline + delta + sparkline), so we don't repeat
                "today / 7d / 30d" totals as separate boxes. */}
            <section className="px-4 pb-12 pt-6 md:px-6">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[15px] font-semibold tracking-tight text-text-primary">
                  Trends
                </h2>
                <p className="text-[11px] text-text-tertiary">
                  Δ vs previous {Math.floor(range / 2)}d
                </p>
              </div>
              {series ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <MetricsChart
                    name="New registrations"
                    subtitle={`Sum over ${rangeLabel.toLowerCase()}`}
                    labels={series.labels}
                    values={series.series.registrations}
                    color={SERIES_COLORS.registrations}
                    total
                  />
                  <MetricsChart
                    name="Daily active users"
                    subtitle="Unique users active each day"
                    labels={series.labels}
                    values={series.series.active_users}
                    color={SERIES_COLORS.active_users}
                    total={false}
                  />
                  <MetricsChart
                    name="Posts"
                    subtitle={`Sum over ${rangeLabel.toLowerCase()}`}
                    labels={series.labels}
                    values={series.series.posts}
                    color={SERIES_COLORS.posts}
                    total
                  />
                  <MetricsChart
                    name="Plans"
                    subtitle={`Sum over ${rangeLabel.toLowerCase()}`}
                    labels={series.labels}
                    values={series.series.plans}
                    color={SERIES_COLORS.plans}
                    total
                  />
                </div>
              ) : (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              )}
            </section>

            <p className="px-4 pb-10 text-[11px] text-text-tertiary md:px-6">
              Revenue, NPS, and cohort retention are intentionally omitted
              until they apply to HangOwl.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { memo, useId, useMemo, useState } from "react";

interface MetricsChartProps {
  /** Series values, oldest to newest. */
  values: number[];
  /** ISO date strings (oldest to newest), one per value. */
  labels: string[];
  /** Display name for the metric. */
  name: string;
  /** Optional secondary label below the name (e.g. "last 14 days"). */
  subtitle?: string;
  /** Stroke + fill colour. Defaults to the app's amber accent. */
  color?: string;
  /** Override the rendered chart-area height. Defaults to 110px. */
  height?: number;
  /**
   * If true, the headline number is the sum of values; if false (default),
   * it's the most recent value. Useful for "registrations this period"
   * (sum) vs "active users right now" (last point) framing.
   */
  total?: boolean;
}

const DEFAULT_COLOR = "#F6BA3D";
const DEFAULT_HEIGHT = 110;
const VIEW_WIDTH = 600;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric" });
}

/**
 * Catmull-Rom spline → cubic-Bezier converter so the line gently curves
 * through every data point without overshooting. Tension 0.5 matches what
 * native chart libs ship as their default "smooth" mode.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function abbreviate(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/**
 * Premium dashboard chart. Headline number on the left, sparkline on the
 * right — the kind of "card" you'd see on a Linear / Stripe / Posthog
 * dashboard. Hovering reveals a vertical guide and tooltip.
 *
 * Zero external deps; the SVG is hand-rolled with a Catmull-Rom spline so
 * the line reads as smooth without any charting library in the bundle.
 */
export const MetricsChart = memo(function MetricsChart({
  values,
  labels,
  name,
  subtitle,
  color = DEFAULT_COLOR,
  height = DEFAULT_HEIGHT,
  total = true,
}: MetricsChartProps) {
  const gradId = useId();
  const lineGradId = `${gradId}-line`;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const data = useMemo(() => values ?? [], [values]);
  const n = data.length;

  // Split the series in halves to compute a period-over-period delta. For
  // a 14-day window this means "last 7 days vs the 7 days before that",
  // which is the classic "is the metric trending up?" comparison.
  const { headline, deltaPct, deltaDir } = useMemo(() => {
    if (n === 0) return { headline: 0, deltaPct: 0, deltaDir: 0 as -1 | 0 | 1 };
    const sum = data.reduce((a, b) => a + b, 0);
    const head = total ? sum : data[n - 1];
    const half = Math.floor(n / 2);
    if (half < 1) return { headline: head, deltaPct: 0, deltaDir: 0 as -1 | 0 | 1 };
    const prev = data.slice(0, n - half).reduce((a, b) => a + b, 0);
    const curr = data.slice(n - half).reduce((a, b) => a + b, 0);
    if (prev === 0 && curr === 0) {
      return { headline: head, deltaPct: 0, deltaDir: 0 as -1 | 0 | 1 };
    }
    if (prev === 0) {
      return { headline: head, deltaPct: 100, deltaDir: 1 as -1 | 0 | 1 };
    }
    const change = ((curr - prev) / prev) * 100;
    return {
      headline: head,
      deltaPct: Math.round(Math.abs(change) * 10) / 10,
      deltaDir: change > 0.05 ? 1 : change < -0.05 ? -1 : 0,
    };
  }, [data, n, total]);

  const padding = useMemo(
    () => ({ top: 10, right: 8, bottom: 22, left: 28 }),
    [],
  );
  const innerW = VIEW_WIDTH - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  // Axis scaling. Anchor to 0 so a stable baseline (and so we can't lie
  // about a 0.1% movement looking dramatic), and pad the top a bit so the
  // peak doesn't kiss the chart's ceiling.
  const max = useMemo(() => {
    const m = Math.max(0, ...data);
    return m === 0 ? 1 : m * 1.12;
  }, [data]);
  const min = 0;

  const points = useMemo(() => {
    if (n === 0) return [] as { x: number; y: number; v: number }[];
    return data.map((v, i) => {
      const x =
        padding.left + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
      const norm = (v - min) / (max - min || 1);
      const y = padding.top + (1 - norm) * innerH;
      return { x, y, v };
    });
  }, [data, n, max, min, padding.left, padding.top, innerW, innerH]);

  const linePath = useMemo(() => smoothPath(points), [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const baseY = padding.top + innerH;
    const head = `M${points[0].x.toFixed(2)} ${baseY.toFixed(2)} L${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    const body = smoothPath(points).replace(/^M[^A-Z]*/, ""); // strip leading "M x y "
    const last = points[points.length - 1];
    const tail = ` L${last.x.toFixed(2)} ${baseY.toFixed(2)} Z`;
    return `${head} ${body}${tail}`;
  }, [points, innerH, padding.top]);

  // 3 horizontal gridlines max so the chart stays clean.
  const gridLines = useMemo(() => {
    const lines: { y: number; v: number }[] = [];
    const steps = 2;
    for (let i = 0; i <= steps; i++) {
      const v = (max * (steps - i)) / steps;
      const norm = (v - min) / (max - min || 1);
      const y = padding.top + (1 - norm) * innerH;
      lines.push({ y, v });
    }
    return lines;
  }, [max, min, padding.top, innerH]);

  const labelEvery = n > 16 ? Math.ceil(n / 5) : n > 8 ? Math.ceil(n / 4) : 1;

  function handleMove(
    e:
      | React.MouseEvent<SVGSVGElement>
      | React.TouchEvent<SVGSVGElement>,
  ) {
    if (n === 0) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX =
      "touches" in e ? e.touches[0]?.clientX ?? rect.left : e.clientX;
    const xRatio = (clientX - rect.left) / rect.width;
    const xView = xRatio * VIEW_WIDTH;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - xView);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIdx(nearest);
  }

  const deltaTone =
    deltaDir === 1
      ? "text-success"
      : deltaDir === -1
        ? "text-danger"
        : "text-text-tertiary";
  const deltaArrow = deltaDir === 1 ? "▲" : deltaDir === -1 ? "▼" : "•";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-surface to-surface/60 p-4 transition-shadow hover:shadow-[0_0_0_1px_rgba(246,186,61,0.18)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h3 className="truncate text-[13px] font-semibold text-text-primary">
              {name}
            </h3>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-text-primary">
              {headline.toLocaleString()}
            </span>
            {n > 1 && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${deltaTone}`}
                aria-label={
                  deltaDir === 1
                    ? `Up ${deltaPct} percent`
                    : deltaDir === -1
                      ? `Down ${deltaPct} percent`
                      : "No change"
                }
              >
                <span aria-hidden>{deltaArrow}</span>
                <span className="tabular-nums">{deltaPct}%</span>
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-text-tertiary">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="relative">
        <svg
          role="img"
          aria-label={`${name} over the last ${n} days`}
          viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
          preserveAspectRatio="none"
          width="100%"
          height={height}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchStart={handleMove}
          onTouchMove={handleMove}
          onTouchEnd={() => setHoverIdx(null)}
          className="block touch-none select-none"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.34" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0.65" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>

          {gridLines.map((g, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                x2={VIEW_WIDTH - padding.right}
                y1={g.y}
                y2={g.y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
              <text
                x={padding.left - 6}
                y={g.y + 3}
                textAnchor="end"
                fontSize="10"
                fill="rgba(220,220,230,0.45)"
              >
                {abbreviate(g.v)}
              </text>
            </g>
          ))}

          {labels.map((l, i) => {
            if (i % labelEvery !== 0 && i !== labels.length - 1) return null;
            const x =
              padding.left + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
            return (
              <text
                key={i}
                x={x}
                y={height - 6}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(220,220,230,0.45)"
              >
                {n > 12 ? shortDate(l) : formatDate(l)}
              </text>
            );
          })}

          {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={`url(#${lineGradId})`}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {hoverIdx !== null && points[hoverIdx] && (
            <>
              <line
                x1={points[hoverIdx].x}
                x2={points[hoverIdx].x}
                y1={padding.top}
                y2={padding.top + innerH}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.45}
              />
              <circle
                cx={points[hoverIdx].x}
                cy={points[hoverIdx].y}
                r={5}
                fill={color}
                opacity={0.18}
              />
              <circle
                cx={points[hoverIdx].x}
                cy={points[hoverIdx].y}
                r={3}
                fill={color}
              />
            </>
          )}
        </svg>

        {hoverIdx !== null && points[hoverIdx] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-ink-900/95 px-2.5 py-1.5 text-[11px] shadow-lg"
            style={{
              left: `${(points[hoverIdx].x / VIEW_WIDTH) * 100}%`,
              top: `${(points[hoverIdx].y / height) * 100}%`,
            }}
          >
            <p className="text-text-tertiary">
              {formatDate(labels[hoverIdx] ?? "")}
            </p>
            <p className="font-semibold tabular-nums text-text-primary">
              {points[hoverIdx].v.toLocaleString()}
            </p>
          </div>
        )}

        {n === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-caption text-text-tertiary">
            No data yet
          </div>
        )}
      </div>
    </div>
  );
});

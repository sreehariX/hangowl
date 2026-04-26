"use client";

import { memo, useId, useMemo, useState } from "react";

interface MetricsChartProps {
  /**
   * Series values, oldest to newest. Length must match `labels` (or be 0,
   * in which case the chart renders an empty placeholder).
   */
  values: number[];
  /**
   * ISO date strings (oldest to newest) used for the x-axis tick labels and
   * the tooltip headline.
   */
  labels: string[];
  /** Display name for the metric, shown in the legend / tooltip. */
  name: string;
  /** Stroke + fill colour. Defaults to the app's amber accent. */
  color?: string;
  /** Variant: line keeps it minimal, area fills under the curve. */
  variant?: "line" | "area";
  /** Override the rendered height. Defaults to 120px. */
  height?: number;
}

const DEFAULT_COLOR = "#F6BA3D";
const DEFAULT_HEIGHT = 120;
const VIEW_WIDTH = 600; // logical width; SVG scales to fill the container

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
 * Tiny dependency-free SVG chart for the admin metrics dashboard.
 *
 * - Renders a smooth(ish) polyline through the data points with optional
 *   area fill; uses a unique gradient id per instance so multiple charts
 *   can coexist without colliding (`useId` keeps it stable across renders).
 * - On hover/touch, snaps a vertical guide line to the nearest sample and
 *   shows a tooltip with the date + value. The hit area is the full SVG so
 *   the user doesn't need pixel-perfect aim on a sparse line.
 */
export const MetricsChart = memo(function MetricsChart({
  values,
  labels,
  name,
  color = DEFAULT_COLOR,
  variant = "area",
  height = DEFAULT_HEIGHT,
}: MetricsChartProps) {
  const gradId = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const padding = useMemo(() => ({ top: 12, right: 8, bottom: 22, left: 28 }), []);
  const innerW = VIEW_WIDTH - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  // Memoise the array reference so downstream useMemo hooks have a stable
  // dependency even when the parent re-creates the prop on each render.
  const data = useMemo(() => values ?? [], [values]);
  const n = data.length;
  const max = Math.max(1, ...data);
  const min = 0; // counts can never be negative; anchoring to 0 keeps the chart honest.

  const points = useMemo(() => {
    if (n === 0) return [] as { x: number; y: number; v: number }[];
    return data.map((v, i) => {
      const x = padding.left + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
      const norm = (v - min) / (max - min || 1);
      const y = padding.top + (1 - norm) * innerH;
      return { x, y, v };
    });
  }, [data, n, max, min, padding.left, padding.top, innerW, innerH]);

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const baseY = padding.top + innerH;
    const first = points[0];
    const last = points[points.length - 1];
    return [
      `M${first.x.toFixed(2)} ${baseY.toFixed(2)}`,
      `L${first.x.toFixed(2)} ${first.y.toFixed(2)}`,
      ...points.slice(1).map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`),
      `L${last.x.toFixed(2)} ${baseY.toFixed(2)}`,
      "Z",
    ].join(" ");
  }, [points, innerH, padding.top]);

  // 4 horizontal gridlines including baseline.
  const gridLines = useMemo(() => {
    const lines: { y: number; v: number }[] = [];
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const v = (max * (steps - i)) / steps;
      const norm = (v - min) / (max - min || 1);
      const y = padding.top + (1 - norm) * innerH;
      lines.push({ y, v: Math.round(v) });
    }
    return lines;
  }, [max, min, padding.top, innerH]);

  // Show every Nth label to avoid x-axis clutter when there are 14+ points.
  const labelEvery = n > 12 ? Math.ceil(n / 6) : n > 6 ? 2 : 1;

  function handleMove(e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) {
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

  const total = data.reduce((a, b) => a + b, 0);
  const peak = max;
  const last = data[data.length - 1] ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-text-primary">{name}</h3>
          <p className="text-[11px] text-text-tertiary">
            Last {n} day{n === 1 ? "" : "s"} · total{" "}
            <span className="tabular-nums text-text-secondary">{total.toLocaleString()}</span>{" "}
            · peak{" "}
            <span className="tabular-nums text-text-secondary">{peak.toLocaleString()}</span>{" "}
            · today{" "}
            <span className="tabular-nums text-text-secondary">{last.toLocaleString()}</span>
          </p>
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
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {gridLines.map((g, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                x2={VIEW_WIDTH - padding.right}
                y1={g.y}
                y2={g.y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <text
                x={padding.left - 6}
                y={g.y + 3}
                textAnchor="end"
                fontSize="10"
                fill="rgba(220,220,230,0.55)"
              >
                {g.v}
              </text>
            </g>
          ))}

          {/* x-axis labels */}
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
                fill="rgba(220,220,230,0.55)"
              >
                {n > 10 ? shortDate(l) : formatDate(l)}
              </text>
            );
          })}

          {variant === "area" && areaPath && (
            <path d={areaPath} fill={`url(#${gradId})`} />
          )}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoverIdx === i ? 3.5 : 2}
              fill={color}
              opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.45}
            />
          ))}

          {hoverIdx !== null && points[hoverIdx] && (
            <line
              x1={points[hoverIdx].x}
              x2={points[hoverIdx].x}
              y1={padding.top}
              y2={padding.top + innerH}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.5}
            />
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
              {points[hoverIdx].v.toLocaleString()} {name.toLowerCase()}
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

"use client";

import { memo, useMemo } from "react";

/*
 * Generative mesh-gradient avatars.
 *
 * Each persona hashes into a deterministic seed that drives:
 *   - a 3-stop pull from a curated premium palette (warm golds, midnight
 *     blues, sage, rose clay, violet, teal, terracotta, forest, sand,
 *     graphite, plum, seafoam);
 *   - the positions of three soft color blobs, rendered as radial
 *     gradients on top of a deep base tone;
 *   - a hue-rotation offset so two adjacent users never share the exact
 *     same composition.
 *
 * Visually inspired by Linear, Vercel's `avatar.vercel.sh`, Loops.so,
 * Arc browser "spaces" — every avatar is a tiny unique artwork but the
 * set still feels like one family because the palette is curated.
 *
 * Rendered inline as SVG so it sharpens at any size and carries no
 * network cost.
 */

const STOPS: string[] = [
  "#F6BA3D", // warm gold
  "#F17E8C", // rose clay
  "#9E89F1", // violet slate
  "#59C5D6", // teal
  "#65D3A3", // sage
  "#EE9F5E", // terracotta
  "#6EB58C", // forest
  "#8AA9F2", // midnight blue
  "#C8A871", // sand
  "#E56B9E", // plum rose
  "#4FB8A9", // seafoam
  "#B5C4E0", // silk blue
  "#FFD05C", // amber light
  "#7BA1F0", // periwinkle
];

const BASES: string[] = [
  "#1A1530", // ink plum
  "#10212E", // deep teal
  "#2A1410", // warm espresso
  "#101A2E", // midnight
  "#1C1A10", // olive dark
  "#201028", // aubergine
];

function hash32(str: string): number {
  // FNV-1a — small, stable, distributes well across short strings.
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

function pickDistinct<T>(arr: readonly T[], n: number, rnd: () => number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(rnd() * pool.length) % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function initialsFor(name: string) {
  // Personas look like "BlushRaven#5763" — drop the numeric suffix and any
  // non-letter decoration before picking initials.
  const trimmed = name.split("#")[0].trim();
  if (!trimmed) return "?";

  // Prefer explicit word boundaries first ("Blush Raven" → BR).
  const words = trimmed.split(/[\s_\-.]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }

  // Otherwise split camelCase so "BlushRaven" → BR, "IronOwl" → IO.
  const camel = trimmed.match(/[A-Z][a-z]*|[a-z]+/g);
  if (camel && camel.length >= 2) {
    return (camel[0].charAt(0) + camel[1].charAt(0)).toUpperCase();
  }

  // Single token — fall back to the first two alphabetic chars.
  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  return (letters.slice(0, 2) || letters.charAt(0) || "?").toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
  /** Show a single-letter instead of two when true. Reserved for tight chips. */
  compact?: boolean;
}

function AvatarComponent({ name, size = 40, className = "", compact }: AvatarProps) {
  const seed = useMemo(() => hash32(name || "?"), [name]);

  const composition = useMemo(() => {
    const rnd = mulberry32(seed);
    const [c1, c2, c3] = pickDistinct(STOPS, 3, rnd);
    const base = pick(BASES, rnd);

    // Three soft blobs positioned on a normalized 0..1 canvas. We bias the
    // first blob toward the top-left so the result reads like a light
    // source — gives each avatar a subtle sense of depth.
    const blobs = [
      {
        color: c1,
        cx: 0.18 + rnd() * 0.22,
        cy: 0.14 + rnd() * 0.22,
        r: 0.58 + rnd() * 0.18,
        alpha: 0.95,
      },
      {
        color: c2,
        cx: 0.62 + rnd() * 0.3,
        cy: 0.22 + rnd() * 0.45,
        r: 0.48 + rnd() * 0.22,
        alpha: 0.85,
      },
      {
        color: c3,
        cx: 0.28 + rnd() * 0.5,
        cy: 0.68 + rnd() * 0.24,
        r: 0.5 + rnd() * 0.22,
        alpha: 0.8,
      },
    ];

    // Small subtle rotation so even the same palette combo reads unique.
    const rotate = Math.floor(rnd() * 360);
    return { base, blobs, rotate };
  }, [seed]);

  const initials = useMemo(() => {
    const full = initialsFor(name);
    return compact ? full.charAt(0) : full;
  }, [name, compact]);

  // Tiny avatars (<=20px) skip the text — they read cleaner as pure gradient
  // medallions in nav bars and inline chips.
  const showText = size >= 22;
  const fontSize = size * (initials.length > 1 ? 0.4 : 0.48);

  // Unique gradient IDs — critical when two avatars render on the same page
  // and share a palette, otherwise the SVG defs would collide.
  const uid = useMemo(() => seed.toString(36), [seed]);

  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {composition.blobs.map((b, i) => (
            <radialGradient
              key={i}
              id={`g-${uid}-${i}`}
              cx={b.cx}
              cy={b.cy}
              r={b.r}
              fx={b.cx}
              fy={b.cy}
            >
              <stop offset="0%" stopColor={b.color} stopOpacity={b.alpha} />
              <stop offset="55%" stopColor={b.color} stopOpacity={b.alpha * 0.35} />
              <stop offset="100%" stopColor={b.color} stopOpacity="0" />
            </radialGradient>
          ))}
          <linearGradient id={`gloss-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform={`rotate(${composition.rotate} 50 50)`}>
          <rect x="-10" y="-10" width="120" height="120" fill={composition.base} />
          {composition.blobs.map((_, i) => (
            <rect
              key={i}
              x="-10"
              y="-10"
              width="120"
              height="120"
              fill={`url(#g-${uid}-${i})`}
            />
          ))}
        </g>
        <rect x="0" y="0" width="100" height="100" fill={`url(#gloss-${uid})`} />
      </svg>

      {showText && (
        <span
          className="relative select-none"
          style={{
            color: "#FFFFFF",
            fontSize,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            lineHeight: 1,
            textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          }}
        >
          {initials}
        </span>
      )}
    </span>
  );
}

export const Avatar = memo(AvatarComponent);

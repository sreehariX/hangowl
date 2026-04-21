"use client";

import { memo, useMemo } from "react";

/*
 * Premium avatar palette — each persona gets a curated duotone gradient
 * (base -> lifted highlight) instead of a flat block. Palette pulls from
 * editorial dark-mode references (Robinhood, Linear, Apple Music) so the
 * set feels like one visual family: warm golds, midnight blues, desaturated
 * greens, terracottas and slate violets.
 */
const PALETTE: { from: string; to: string; ink: string }[] = [
  { from: "#4A6BC8", to: "#8AA9F2", ink: "#0B1126" }, // midnight blue
  { from: "#C58B28", to: "#F6BA3D", ink: "#2A1C00" }, // warm gold
  { from: "#2F9E7A", to: "#65D3A3", ink: "#052017" }, // sage
  { from: "#C4475B", to: "#F17E8C", ink: "#2A0A10" }, // rose clay
  { from: "#6A54C4", to: "#9E89F1", ink: "#130B2A" }, // violet slate
  { from: "#2F8EA3", to: "#59C5D6", ink: "#041B20" }, // teal
  { from: "#C26B3A", to: "#EE9F5E", ink: "#2A1204" }, // terracotta
  { from: "#566578", to: "#8D9CB0", ink: "#0E141C" }, // graphite
  { from: "#8C7245", to: "#C8A871", ink: "#221704" }, // sand
  { from: "#3D7D5C", to: "#6EB58C", ink: "#061A10" }, // forest
];

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initialsFor(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
  ring?: boolean;
}

function AvatarComponent({ name, size = 40, className = "", ring }: AvatarProps) {
  const { from, to, ink } = useMemo(
    () => PALETTE[hash(name || "?") % PALETTE.length],
    [name],
  );
  const initials = initialsFor(name);
  // Slightly tighter letter for two-char initials so it still breathes.
  const fontSize = size * (initials.length > 1 ? 0.38 : 0.44);

  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(120% 120% at 28% 22%, ${to} 0%, ${from} 60%, ${from} 100%)`,
        boxShadow: ring
          ? `inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 2px rgba(246,186,61,0.9)`
          : `inset 0 0 0 1px rgba(255,255,255,0.08)`,
      }}
    >
      {/* Subtle top gloss — ~8% white, never banded */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 42%)",
        }}
      />
      <span
        className="relative tabular-nums"
        style={{
          color: ink,
          fontSize,
          fontWeight: 650,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          textShadow: "0 1px 0 rgba(255,255,255,0.18)",
        }}
      >
        {initials}
      </span>
    </span>
  );
}

export const Avatar = memo(AvatarComponent);

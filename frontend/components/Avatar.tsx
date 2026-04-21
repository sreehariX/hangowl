"use client";

import { memo } from "react";

/* A small, curated palette — avatars feel like one family. */
const PALETTE = [
  "#5B83D4",
  "#F6BA3D",
  "#34D99F",
  "#FF6B7D",
  "#8B6FE8",
  "#3FB8C9",
  "#E88B4A",
  "#6B87A8",
] as const;

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

function AvatarComponent({ name, size = 40, className = "" }: AvatarProps) {
  const bg = PALETTE[hash(name) % PALETTE.length];
  const initial = (name.trim().charAt(0) || "?").toUpperCase();

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.42,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: "-0.01em",
      }}
    >
      {initial}
    </span>
  );
}

export const Avatar = memo(AvatarComponent);

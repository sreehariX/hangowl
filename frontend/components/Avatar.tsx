"use client";

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, size = 40, className = "" }: AvatarProps) {
  const hash = hashCode(name);

  const hue1 = hash % 360;
  const hue2 = (hue1 + 40 + (hash % 60)) % 360;
  const color1 = hslToHex(hue1, 0.7, 0.55);
  const color2 = hslToHex(hue2, 0.65, 0.45);

  const grid = 5;
  const cells: boolean[][] = [];
  const half = Math.ceil(grid / 2);

  for (let row = 0; row < grid; row++) {
    cells[row] = [];
    for (let col = 0; col < half; col++) {
      const bit = (hash >> ((row * half + col) % 30)) & 1;
      cells[row][col] = bit === 1;
      cells[row][grid - 1 - col] = bit === 1;
    }
  }

  const cellSize = size / (grid + 2);
  const offset = cellSize;

  const initial = name.charAt(0).toUpperCase();

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ borderRadius: size * 0.22 }}
    >
      <defs>
        <linearGradient id={`grad-${hash}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <rect width={size} height={size} rx={size * 0.22} fill={`url(#grad-${hash})`} />
      {cells.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={offset + c * cellSize}
              y={offset + r * cellSize}
              width={cellSize * 0.85}
              height={cellSize * 0.85}
              rx={cellSize * 0.15}
              fill="rgba(255,255,255,0.35)"
            />
          ) : null
        )
      )}
      <text
        x={size / 2}
        y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="rgba(255,255,255,0.9)"
        fontSize={size * 0.32}
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {initial}
      </text>
    </svg>
  );
}

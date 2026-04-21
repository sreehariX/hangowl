"use client";

interface SegmentedControlProps {
  tabs: string[];
  active: number;
  onChange: (index: number) => void;
}

export function SegmentedControl({ tabs, active, onChange }: SegmentedControlProps) {
  const count = tabs.length;
  const pct = 100 / count;

  return (
    <div
      className="relative flex rounded-full border border-border p-1"
      role="tablist"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-surface-hover transition-transform duration-200 ease-[var(--ease)]"
        style={{
          width: `calc(${pct}% - 0.25rem)`,
          transform: `translateX(${active * 100}%)`,
        }}
      />
      {tabs.map((tab, i) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === i}
          onClick={() => onChange(i)}
          className={`relative z-[1] flex-1 rounded-full py-2 text-caption font-semibold transition-colors ${
            active === i ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

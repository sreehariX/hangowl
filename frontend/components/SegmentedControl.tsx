"use client";

interface SegmentedControlProps {
  tabs: string[];
  active: number;
  onChange: (index: number) => void;
}

/**
 * Apple-style segmented control. Uses a translating pill indicator so the
 * transition between tabs feels physical rather than abrupt.
 */
export function SegmentedControl({ tabs, active, onChange }: SegmentedControlProps) {
  const count = tabs.length;
  const pct = 100 / count;

  return (
    <div
      className="relative flex rounded-2xl border border-border/60 bg-ink-850/70 p-1 backdrop-blur-xl"
      role="tablist"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-xl bg-surface-raised shadow-soft transition-transform duration-300 ease-[var(--ease-premium)]"
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
          className={`relative z-[1] flex-1 rounded-xl py-2.5 text-caption font-semibold tracking-tight transition-colors duration-200 ${
            active === i
              ? "text-text-primary"
              : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

"use client";

interface SegmentedControlProps {
  tabs: string[];
  active: number;
  onChange: (index: number) => void;
}

export function SegmentedControl({ tabs, active, onChange }: SegmentedControlProps) {
  return (
    <div className="glass-surface flex gap-1 rounded-2xl p-1.5">
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onChange(i)}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
            active === i
              ? "bg-surface text-text-primary shadow-soft"
              : "text-text-muted hover:bg-navy-lighter/50 hover:text-text-secondary"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

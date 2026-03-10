"use client";

interface SegmentedControlProps {
  tabs: string[];
  active: number;
  onChange: (index: number) => void;
}

export function SegmentedControl({ tabs, active, onChange }: SegmentedControlProps) {
  return (
    <div className="flex rounded-xl bg-navy-lighter p-1 gap-1">
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onChange(i)}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
            active === i
              ? "bg-surface text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

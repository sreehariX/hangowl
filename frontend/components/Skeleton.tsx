"use client";

export function PlanCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-3 w-16" />
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="skeleton h-3 w-full" />
      <div className="flex justify-between">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export function PlanListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <PlanCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return <div className="skeleton h-12 w-20 rounded-lg" />;
}

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl bg-surface p-3">
          <div className="skeleton h-8 w-8 rounded-full" />
          <div className="skeleton h-4 w-32 flex-1" />
          <div className="skeleton h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

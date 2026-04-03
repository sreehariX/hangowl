"use client";

export function PostCardSkeleton() {
  return (
    <div className="border-b border-border px-4 py-3.5">
      <div className="flex gap-3">
        <div className="skeleton h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-2.5 pt-0.5">
          {/* Name · time inline */}
          <div className="flex items-center gap-2">
            <div className="skeleton h-3.5 w-[100px] rounded-full" />
            <div className="skeleton h-3 w-1 rounded-full opacity-60" />
            <div className="skeleton h-3 w-7 rounded-full opacity-60" />
          </div>
          {/* Content lines */}
          <div className="skeleton h-3.5 w-full rounded-full" />
          <div className="skeleton h-3.5 w-[78%] rounded-full" />
          {/* Action row */}
          <div className="flex items-center gap-6 pt-0.5">
            <div className="skeleton h-3 w-7 rounded-full" />
            <div className="skeleton h-3 w-7 rounded-full" />
            <div className="skeleton h-3 w-7 rounded-full" />
            <div className="skeleton ml-auto h-3 w-9 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PlanCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-24 rounded-full" />
          <div className="skeleton h-3 w-16 rounded-full" />
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="skeleton h-3.5 w-full rounded-full" />
      <div className="flex justify-between">
        <div className="skeleton h-3 w-20 rounded-full" />
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
          <div className="skeleton h-3.5 w-32 rounded-full flex-1" />
          <div className="skeleton h-3.5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

"use client";

export function PostCardSkeleton() {
  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex gap-3">
        <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-3 w-32 rounded-full" />
          <div className="skeleton h-3.5 w-full rounded-full" />
          <div className="skeleton h-3.5 w-4/5 rounded-full" />
          <div className="mt-1 flex gap-5">
            <div className="skeleton h-3 w-10 rounded-full" />
            <div className="skeleton h-3 w-10 rounded-full" />
            <div className="skeleton h-3 w-10 rounded-full" />
            <div className="skeleton ml-auto h-3 w-10 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </>
  );
}

export function PlanCardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-28 rounded-full" />
          <div className="skeleton h-3 w-20 rounded-full" />
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="skeleton h-3 w-full rounded-full" />
      <div className="flex justify-between">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton h-8 w-20 rounded-full" />
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

export function LeaderboardSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border py-3">
          <div className="skeleton h-8 w-8 rounded-full" />
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="skeleton h-4 flex-1 rounded-full" />
          <div className="skeleton h-4 w-12 rounded-full" />
        </div>
      ))}
    </>
  );
}

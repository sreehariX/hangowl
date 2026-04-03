"use client";

// Widths mirror realistic post length variation — no two cards look the same
const CONTENT_WIDTHS: [string, string, string][] = [
  ["100%", "91%", "72%"],
  ["100%", "85%", "60%"],
  ["100%", "94%", "78%"],
  ["96%", "80%", "55%"],
  ["100%", "88%", "68%"],
  ["100%", "76%", "0"],   // short post — only 2 lines
];

export function PostCardSkeleton({ index = 0 }: { index?: number }) {
  const [w1, w2, w3] = CONTENT_WIDTHS[index % CONTENT_WIDTHS.length];
  return (
    <div className="border-b border-border px-4 py-3.5">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="skeleton h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 min-w-0">
          {/* Name · timestamp row */}
          <div className="flex items-center gap-1.5 mb-2">
            <div className="skeleton h-3.5 w-24 rounded-full" />
            <div className="skeleton h-2.5 w-1.5 rounded-full opacity-50" />
            <div className="skeleton h-3 w-6 rounded-full opacity-60" />
          </div>
          {/* Content lines */}
          <div className="space-y-2">
            <div className="skeleton h-3.5 rounded-full" style={{ width: w1 }} />
            <div className="skeleton h-3.5 rounded-full" style={{ width: w2 }} />
            {w3 !== "0" && (
              <div className="skeleton h-3.5 rounded-full" style={{ width: w3 }} />
            )}
          </div>
          {/* Action bar */}
          <div className="flex items-center gap-5 mt-3.5">
            <div className="skeleton h-3 w-8 rounded-full" />
            <div className="skeleton h-3 w-8 rounded-full" />
            <div className="skeleton h-3 w-8 rounded-full" />
            <div className="skeleton ml-auto h-3 w-10 rounded-full opacity-60" />
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
        <PostCardSkeleton key={i} index={i} />
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

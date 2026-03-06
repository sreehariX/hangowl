"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { LeaderboardSkeleton } from "@/components/Skeleton";
import type { LeaderboardEntry } from "@/lib/types";

const RANK_COLORS = [
  "border-amber/30 bg-amber/5",
  "border-slate-300/20 bg-slate-300/5",
  "border-orange-400/20 bg-orange-400/5",
];

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await api.getLeaderboard();
      setLeaderboard(data.leaderboard);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div className="mx-auto max-w-lg px-4 pt-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Top joiners
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          People who join the most plans
        </p>
      </div>

      {loading ? (
        <LeaderboardSkeleton />
      ) : leaderboard.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-3xl mb-3">🏆</div>
          <p className="text-text-secondary text-sm">
            No one has joined a plan yet. Post one or join one to get on the list.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry) => {
            const style = entry.rank <= 3
              ? RANK_COLORS[entry.rank - 1]
              : "border-border bg-surface";
            return (
              <div
                key={entry.persona_name}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${style}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                  {entry.rank <= 3
                    ? ["🥇", "🥈", "🥉"][entry.rank - 1]
                    : <span className="text-text-muted">{entry.rank}</span>}
                </div>
                <Avatar name={entry.persona_name} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-text-primary truncate">
                    {entry.persona_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-text-primary">
                    {entry.hangout_count}
                  </p>
                  <p className="text-[10px] text-text-muted">hangouts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

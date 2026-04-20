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

export default function RanksPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await api.getLeaderboard();
      setLeaderboard(data.leaderboard);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div className="app-shell pt-5">
      <div className="app-content">
      <div className="mb-6 text-center">
        <p className="section-title mb-1">Leaderboard</p>
        <h1 className="text-2xl font-semibold text-text-primary">Campus ranks</h1>
        <p className="mt-1 text-xs text-text-muted">Most active on campus</p>
      </div>

      {loading ? (
        <LeaderboardSkeleton />
      ) : leaderboard.length === 0 ? (
        <div className="panel-surface p-8 text-center">
          <p className="text-sm text-text-secondary">No hangouts yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry) => {
            const style = entry.rank <= 3 ? RANK_COLORS[entry.rank - 1] : "border-border/80 bg-surface/85";
            return (
              <div
                key={entry.persona_name}
                className={`panel-surface flex items-center gap-3 border p-3 transition-colors ${style}`}
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
                  <p className="font-bold text-sm text-text-primary">{entry.hangout_count}</p>
                  <p className="text-[10px] text-text-muted">hangouts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

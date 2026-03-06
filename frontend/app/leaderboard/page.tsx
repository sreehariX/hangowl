"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LeaderboardSkeleton } from "@/components/Skeleton";
import type { LeaderboardEntry } from "@/lib/types";

const RANK_STYLES = [
  "bg-amber/15 text-amber border-amber/30",
  "bg-slate-300/10 text-slate-300 border-slate-300/20",
  "bg-orange-400/10 text-orange-400 border-orange-400/20",
];

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [topPersona, setTopPersona] = useState<{
    persona_name: string;
    hangout_count: number;
    hostel: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await api.getLeaderboard();
      setLeaderboard(data.leaderboard);
      setTopPersona(data.most_spontaneous);
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
          Hostel Leaderboard
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Which hostel hangs out the most?
        </p>
      </div>

      {topPersona && (
        <div className="mb-8 rounded-2xl border border-amber/20 bg-amber/5 p-5 text-center">
          <p className="text-xs text-text-muted mb-2">Most Spontaneous Owl</p>
          <p className="text-lg font-bold text-amber">
            {topPersona.persona_name}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            {topPersona.hangout_count} hangouts &middot; {topPersona.hostel}
          </p>
        </div>
      )}

      {loading ? (
        <LeaderboardSkeleton />
      ) : leaderboard.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="text-3xl mb-3">🏠</div>
          <p className="text-text-secondary text-sm">
            No hostel data yet. Be the first to hang out!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry) => {
            const style =
              entry.rank <= 3
                ? RANK_STYLES[entry.rank - 1]
                : "bg-surface text-text-secondary border-border";
            return (
              <div
                key={entry.hostel}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${style}`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm ${
                    entry.rank <= 3
                      ? "bg-current/10"
                      : "bg-navy-lighter text-text-muted"
                  }`}
                >
                  {entry.rank <= 3
                    ? ["🥇", "🥈", "🥉"][entry.rank - 1]
                    : entry.rank}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{entry.hostel}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">
                    {entry.total_hangouts}
                  </p>
                  <p className="text-xs opacity-60">hangouts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-text-muted">
        Leaderboard resets every Monday
      </p>
    </div>
  );
}

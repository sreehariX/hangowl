"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { LeaderboardSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/primitives";
import { TrophyIcon } from "@/components/icons";
import type { LeaderboardEntry } from "@/lib/types";

/**
 * Rank styling uses theme tokens (amber / brand / a copper-toned amber)
 * so the leaderboard never looks disconnected from the rest of the app.
 */
const RANK_TONES: Record<number, { ring: string; badge: string; label: string }> = {
  1: {
    ring: "ring-amber/40",
    badge: "bg-gradient-to-br from-amber-400 to-amber-700 text-ink-950 shadow-glow-amber",
    label: "🥇",
  },
  2: {
    ring: "ring-text-secondary/30",
    badge: "bg-gradient-to-br from-text-secondary to-text-tertiary text-ink-950",
    label: "🥈",
  },
  3: {
    ring: "ring-amber-700/40",
    badge: "bg-gradient-to-br from-amber-700 to-amber-600 text-ink-950",
    label: "🥉",
  },
};

export default function RanksPage() {
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
    <div className="app-shell pt-5">
      <div className="app-content">
        <header className="mb-6 text-center">
          <p className="section-eyebrow mb-1.5">Leaderboard</p>
          <h1 className="text-title-lg font-semibold tracking-tight text-text-primary">
            Campus ranks
          </h1>
          <p className="mt-1.5 text-caption text-text-tertiary">
            The most active crew on campus this season.
          </p>
        </header>

        {loading ? (
          <LeaderboardSkeleton />
        ) : leaderboard.length === 0 ? (
          <div className="surface-panel">
            <EmptyState
              icon={<TrophyIcon size={28} />}
              title="No ranks yet"
              description="Host or join hangouts to climb the board."
            />
          </div>
        ) : (
          <div className="surface-panel divide-y divide-border/40 overflow-hidden">
            {leaderboard.map((entry) => {
              const tone = RANK_TONES[entry.rank];
              return (
                <div
                  key={entry.persona_name}
                  className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover/50 ${
                    tone ? "bg-gradient-to-r from-transparent via-transparent to-amber/[0.03]" : ""
                  }`}
                >
                  {tone ? (
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${tone.badge}`}
                      aria-label={`Rank ${entry.rank}`}
                    >
                      {tone.label}
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover text-caption font-bold tabular-nums text-text-tertiary">
                      {entry.rank}
                    </div>
                  )}
                  <div
                    className={`shrink-0 rounded-xl p-0.5 ${
                      tone ? `ring-1 ${tone.ring}` : ""
                    }`}
                  >
                    <Avatar name={entry.persona_name} size={36} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-text-primary">
                      {entry.persona_name}
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      {entry.hangout_count}{" "}
                      {entry.hangout_count === 1 ? "hangout" : "hangouts"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-title font-bold tabular-nums text-text-primary">
                      {entry.hangout_count}
                    </p>
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

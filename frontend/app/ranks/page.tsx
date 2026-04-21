"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { LeaderboardSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/primitives";
import { ArrowLeftIcon, TrophyIcon } from "@/components/icons";
import type { LeaderboardEntry } from "@/lib/types";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function RanksPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await api.getLeaderboard();
      setLeaderboard(data.leaderboard);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  return (
    <div className="app-shell pt-0">
      <div className="app-content">
        <div className="sticky-bar">
          <button onClick={() => router.back()} className="icon-btn" aria-label="Back">
            <ArrowLeftIcon size={20} />
          </button>
          <span className="text-[17px] font-semibold text-text-primary">
            Leaderboard
          </span>
        </div>

        <p className="border-b border-border px-4 py-3 text-caption text-text-tertiary">
          Most active crew on campus this season.
        </p>

        {loading ? (
          <div className="px-4 pt-4">
            <LeaderboardSkeleton />
          </div>
        ) : leaderboard.length === 0 ? (
          <EmptyState
            icon={<TrophyIcon size={22} />}
            title="No ranks yet"
            description="Host or join hangouts to climb the board."
          />
        ) : (
          leaderboard.map((entry) => {
            const medal = MEDALS[entry.rank];
            return (
              <div
                key={entry.persona_name}
                className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-surface-hover/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-caption font-semibold tabular-nums text-text-tertiary">
                  {medal || entry.rank}
                </span>
                <Avatar name={entry.persona_name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-text-primary">
                    {entry.persona_name}
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    {entry.hangout_count}{" "}
                    {entry.hangout_count === 1 ? "hangout" : "hangouts"}
                  </p>
                </div>
                <span className="shrink-0 text-headline font-semibold tabular-nums text-text-primary">
                  {entry.hangout_count}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

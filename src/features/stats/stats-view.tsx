"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Film,
  Play,
  Trash2,
} from "lucide-react";
import {
  clearLocalHistory,
  getDefaultStorageData,
  loadLocalData,
  type ModeLevelStat,
  type ReelClueStorageData,
} from "@/lib/client/storage";
import { modes } from "@/features/game/components";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

export function StatsView() {
  const [data, setData] = useState<ReelClueStorageData>(() => {
    if (typeof window !== "undefined") {
      return loadLocalData();
    }
    return getDefaultStorageData();
  });
  const [selectedMode, setSelectedMode] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);

  const handleClear = () => {
    clearLocalHistory();
    setData(loadLocalData());
    setShowClearConfirm(false);
    setClearedNotice(true);
  };

  // Overall aggregates across all modes & difficulties
  const overall = useMemo(() => {
    if (!data) return { games: 0, score: 0, best: 0, correct: 0, rounds: 0, hints: 0, wrong: 0 };
    let games = 0;
    let score = 0;
    let best = 0;
    let correct = 0;
    let rounds = 0;
    let hints = 0;
    let wrong = 0;

    for (const stat of Object.values(data.stats)) {
      games += stat.games_played;
      score += stat.total_score;
      best = Math.max(best, stat.best_score);
      correct += stat.total_correct_rounds;
      rounds += stat.total_rounds;
      hints += stat.total_hints_used;
      wrong += stat.total_wrong_attempts;
    }

    return { games, score, best, correct, rounds, hints, wrong };
  }, [data]);

  const accuracy = overall.rounds > 0 ? Math.round((overall.correct / overall.rounds) * 100) : 0;

  // Filtered list of mode+level stats
  const filteredBreakdown = useMemo(() => {
    if (!data) return [];
    const items: Array<{
      modeId: string;
      modeLabel: string;
      level: Difficulty;
      stat: ModeLevelStat;
    }> = [];

    for (const mode of modes) {
      if (selectedMode !== "all" && selectedMode !== mode.id) continue;

      for (const lvl of DIFFICULTIES) {
        if (selectedLevel !== "all" && selectedLevel !== lvl) continue;

        const statKey = `${mode.id}:${lvl}`;
        const s = data.stats[statKey];
        if (s && s.games_played > 0) {
          items.push({
            modeId: mode.id,
            modeLabel: mode.label,
            level: lvl,
            stat: s,
          });
        }
      }
    }

    return items;
  }, [data, selectedMode, selectedLevel]);

  return (
    <main className="mx-auto max-w-280 space-y-8 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="space-y-4 border-b border-border/50 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Film aria-hidden="true" className="size-5" />
            <span>ReelClue</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/about"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <span>About</span>
            </Link>
            <Link
              href="/play"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <Play aria-hidden="true" className="size-4 fill-current" />
              <span>Play</span>
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Device Statistics
          </h1>
          <p className="text-sm text-muted-foreground">
            Per-device performance records stored locally in your browser. No accounts, no serverside tracking.
          </p>
        </div>
      </header>

      {/* Cleared Notice */}
      {clearedNotice && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/50 p-4 text-sm text-foreground"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="size-4 text-primary" />
            <span>Local device statistics and history have been cleared.</span>
          </div>
          <button
            type="button"
            onClick={() => setClearedNotice(false)}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Dismiss
          </button>
        </div>
      )}

      {overall.games === 0 ? (
        /* Empty State */
        <section
          aria-labelledby="empty-stats-heading"
          className="rounded-2xl border border-input bg-card p-8 text-center space-y-5"
        >
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <BarChart3 aria-hidden="true" className="size-7" />
          </div>
          <div className="space-y-2">
            <h2 id="empty-stats-heading" className="text-2xl font-bold text-foreground">
              No games completed yet
            </h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Complete a 10-round game session to start tracking your accuracy, hints, and best scores across modes.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/play"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <Play aria-hidden="true" className="size-4 fill-current" />
              <span>Start Your First Game</span>
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* Overview Stat Cards */}
          <section aria-labelledby="overall-stats-heading" className="space-y-4">
            <h2 id="overall-stats-heading" className="text-xl font-bold tracking-tight text-foreground">
              Overall Summary
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-border/50 bg-card p-5">
                <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                  Games Played
                </span>
                <span className="mt-1 block text-3xl font-bold text-foreground">
                  {overall.games}
                </span>
                <span className="text-xs text-muted-foreground">
                  {data.completed_session_ids.length} recorded
                </span>
              </div>

              <div className="rounded-xl border border-border/50 bg-card p-5">
                <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                  Overall Accuracy
                </span>
                <span className="mt-1 block text-3xl font-bold text-primary">
                  {accuracy}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {overall.correct} of {overall.rounds} rounds
                </span>
              </div>

              <div className="rounded-xl border border-border/50 bg-card p-5">
                <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                  Best Game Score
                </span>
                <span className="mt-1 block text-3xl font-bold text-foreground">
                  {overall.best}
                </span>
                <span className="text-xs text-muted-foreground">
                  pts in single session
                </span>
              </div>

              <div className="rounded-xl border border-border/50 bg-card p-5">
                <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                  Hints & Mistakes
                </span>
                <span className="mt-1 block text-3xl font-bold text-foreground">
                  {overall.hints}
                </span>
                <span className="text-xs text-muted-foreground">
                  hints / {overall.wrong} wrong guesses
                </span>
              </div>
            </div>
          </section>

          {/* Breakdown by Mode & Level */}
          <section aria-labelledby="breakdown-heading" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-3">
              <h2 id="breakdown-heading" className="text-xl font-bold tracking-tight text-foreground">
                Performance by Mode & Difficulty
              </h2>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>Mode:</span>
                  <select
                    value={selectedMode}
                    onChange={e => setSelectedMode(e.target.value)}
                    className="h-9 rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <option value="all">All Modes</option>
                    {modes.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>Difficulty:</span>
                  <select
                    value={selectedLevel}
                    onChange={e => setSelectedLevel(e.target.value)}
                    className="h-9 rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <option value="all">All Tiers</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>
            </div>

            {filteredBreakdown.length === 0 ? (
              <div className="rounded-xl border border-border/50 bg-card p-6 text-center text-sm text-muted-foreground">
                No games completed for the selected mode and difficulty filter.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredBreakdown.map(item => {
                  const statAcc =
                    item.stat.total_rounds > 0
                      ? Math.round((item.stat.total_correct_rounds / item.stat.total_rounds) * 100)
                      : 0;
                  const avgScore =
                    item.stat.games_played > 0
                      ? Math.round(item.stat.total_score / item.stat.games_played)
                      : 0;

                  return (
                    <article
                      key={`${item.modeId}:${item.level}`}
                      className="rounded-xl border border-input bg-card p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-border/40 pb-3">
                        <div className="space-y-0.5">
                          <h3 className="font-bold text-foreground">{item.modeLabel}</h3>
                          <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {item.level}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-lg font-bold text-primary">
                            {statAcc}%
                          </span>
                          <span className="text-xs text-muted-foreground">accuracy</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-secondary/30 p-2.5">
                          <span className="block text-muted-foreground">Games</span>
                          <span className="mt-0.5 block text-base font-semibold text-foreground">
                            {item.stat.games_played}
                          </span>
                        </div>
                        <div className="rounded-lg bg-secondary/30 p-2.5">
                          <span className="block text-muted-foreground">Best Score</span>
                          <span className="mt-0.5 block text-base font-semibold text-foreground">
                            {item.stat.best_score}
                          </span>
                        </div>
                        <div className="rounded-lg bg-secondary/30 p-2.5">
                          <span className="block text-muted-foreground">Avg Score</span>
                          <span className="mt-0.5 block text-base font-semibold text-foreground">
                            {avgScore}
                          </span>
                        </div>
                        <div className="rounded-lg bg-secondary/30 p-2.5">
                          <span className="block text-muted-foreground">Hints / Misses</span>
                          <span className="mt-0.5 block text-base font-semibold text-foreground">
                            {item.stat.total_hints_used} / {item.stat.total_wrong_attempts}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Clear History Flow */}
          <section aria-labelledby="clear-history-heading" className="pt-6 border-t border-border/50">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
              <div className="space-y-1">
                <h2 id="clear-history-heading" className="text-base font-semibold text-foreground">
                  Clear Local Device History
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Reset your recorded games, accuracy, and recent movie exclusions on this device. Your mode and difficulty preferences will be preserved.
                </p>
              </div>

              {showClearConfirm ? (
                <div
                  role="alertdialog"
                  aria-labelledby="clear-dialog-title"
                  aria-describedby="clear-dialog-desc"
                  className="rounded-lg border border-destructive/50 bg-card p-4 space-y-3"
                >
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
                    <div>
                      <h3 id="clear-dialog-title" className="text-sm font-semibold text-foreground">
                        Are you sure you want to clear device history?
                      </h3>
                      <p id="clear-dialog-desc" className="text-xs text-muted-foreground mt-0.5">
                        This action cannot be undone. All your per-device statistics and recent movie history will be wiped immediately.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleClear}
                      className="inline-flex min-h-11 items-center justify-center rounded-md bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                      Yes, Clear History
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-destructive/40 bg-card px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  <span>Clear History</span>
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
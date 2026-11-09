"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Film,
  HelpCircle,
  RotateCcw,
  Share2,
  Trophy,
  XCircle,
} from "lucide-react";
import type { GameResultsDto } from "@/lib/server/game/dto";
import { recordCompletedSession } from "@/lib/client/storage";
import {
  executeShare,
  generateSpoilerFreeSharePayload,
  getRoundOutcomeText,
  type ShareRoundSummary,
} from "@/lib/client/sharing";
import { modes, type Level } from "./components";

export function ResultsView({
  results,
  isDaily,
  dailyDate,
}: {
  results: GameResultsDto;
  isDaily?: boolean;
  dailyDate?: string;
}) {
  const modeObj = modes.find(m => m.id === results.mode);
  const modeLabel = isDaily ? "Daily Challenge" : modeObj?.label ?? results.mode;
  const levelLabel = (results.level.charAt(0).toUpperCase() + results.level.slice(1)) as Level;

  const [shareStatus, setShareStatus] = useState<"idle" | "sharing" | "copied" | "shared" | "cancelled" | "error">("idle");
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [manualShareText, setManualShareText] = useState<string | null>(null);

  useEffect(() => {
    recordCompletedSession(results);
  }, [results]);

  const shareRounds: ShareRoundSummary[] = results.rounds.map(r => ({
    ordinal: r.ordinal,
    outcome: r.reveal.outcome,
    hintsUsed: r.reveal.hints_used,
    wrongAttempts: r.reveal.wrong_attempts,
  }));

  const handleShare = async () => {
    setShareStatus("sharing");
    setShareFeedback(null);
    setManualShareText(null);

    const origin = typeof window !== "undefined" ? window.location.origin : undefined;

    const payload = generateSpoilerFreeSharePayload({
      mode: results.mode,
      level: results.level,
      score: results.score,
      maxScore: results.max_score,
      correctCount: results.correct_count,
      totalRounds: results.total_rounds,
      rounds: shareRounds,
      origin,
      isDaily,
      dailyDate,
    });

    const res = await executeShare(payload);

    if (res.type === "copied") {
      setShareStatus("copied");
      setShareFeedback("Results copied to clipboard (spoiler-free)!");
    } else if (res.type === "shared") {
      setShareStatus("shared");
      setShareFeedback("Results shared successfully!");
    } else if (res.type === "cancelled") {
      setShareStatus("cancelled");
      setShareFeedback("Share cancelled.");
    } else {
      setShareStatus("error");
      setShareFeedback(res.message);
      setManualShareText(payload.fullMessage);
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-border/50 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <Film aria-hidden="true" className="size-5" />
          <span>ReelClue</span>
        </Link>
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Game Completed
        </span>
      </header>

      {/* Score Hero */}
      <section
        aria-labelledby="results-summary-heading"
        className="space-y-6 rounded-2xl border border-input bg-card p-6 text-center sm:p-8"
      >
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Trophy aria-hidden="true" className="size-9" />
        </div>

        <div className="space-y-2">
          <h1
            id="results-summary-heading"
            className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            Session Results
          </h1>
          <p className="text-sm text-muted-foreground">
            {modeLabel} · {levelLabel} Tier
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
            <span className="block text-xs uppercase tracking-wider text-muted-foreground">
              Final Score
            </span>
            <span className="mt-1 block text-2xl font-bold text-primary sm:text-3xl">
              {results.score}
            </span>
            <span className="text-xs text-muted-foreground">out of {results.max_score}</span>
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
            <span className="block text-xs uppercase tracking-wider text-muted-foreground">
              Accuracy
            </span>
            <span className="mt-1 block text-2xl font-bold text-foreground sm:text-3xl">
              {results.accuracy}%
            </span>
            <span className="text-xs text-muted-foreground">
              {results.correct_count} of {results.total_rounds} correct
            </span>
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
            <span className="block text-xs uppercase tracking-wider text-muted-foreground">
              Hints Used
            </span>
            <span className="mt-1 block text-2xl font-bold text-foreground sm:text-3xl">
              {results.total_hints_used}
            </span>
            <span className="text-xs text-muted-foreground">across all rounds</span>
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
            <span className="block text-xs uppercase tracking-wider text-muted-foreground">
              Wrong Guesses
            </span>
            <span className="mt-1 block text-2xl font-bold text-foreground sm:text-3xl">
              {results.total_wrong_attempts}
            </span>
            <span className="text-xs text-muted-foreground">out of 30 allowed</span>
          </div>
        </div>

        {/* Outcome Grid */}
        <div
          role="region"
          aria-label="Round outcome grid"
          className="mx-auto max-w-md rounded-xl border border-border/50 bg-secondary/20 p-4 space-y-2 text-left"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Round Outcome Grid</span>
            <span>{results.correct_count} of {results.total_rounds} Solved</span>
          </div>
          <div
            className="grid grid-cols-5 gap-2 sm:grid-cols-10"
            role="list"
            aria-label={`10 rounds outcome summary: ${results.correct_count} solved`}
          >
            {shareRounds.map(r => {
              const isCorrectClean = r.outcome === "correct" && r.hintsUsed === 0 && r.wrongAttempts === 0;
              const isCorrectAssisted = r.outcome === "correct" && !isCorrectClean;
              const isExhausted = r.outcome === "exhausted";
              const label = getRoundOutcomeText(r);

              return (
                <div
                  key={r.ordinal}
                  role="listitem"
                  title={label}
                  aria-label={label}
                  className={`flex flex-col items-center justify-center rounded-lg border p-1.5 text-xs font-bold transition-colors ${
                    isCorrectClean
                      ? "border-success/50 bg-success/20 text-success"
                      : isCorrectAssisted
                        ? "border-primary/50 bg-primary/20 text-primary"
                        : isExhausted
                          ? "border-destructive/50 bg-destructive/20 text-destructive"
                          : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="text-[10px] opacity-75">R{r.ordinal}</span>
                  <span className="text-base" aria-hidden="true">
                    {isCorrectClean ? "🟩" : isCorrectAssisted ? "🟨" : isExhausted ? "🟥" : "⬜"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="sr-only">
            {shareRounds.map(getRoundOutcomeText).join(". ")}
          </p>
        </div>

        {/* Feedback / Copy Fallback */}
        {shareFeedback && (
          <div
            role="status"
            aria-live="polite"
            className={`mx-auto max-w-md rounded-lg border p-3 text-sm font-medium ${
              shareStatus === "error"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-primary/40 bg-primary/10 text-primary"
            }`}
          >
            <p>{shareFeedback}</p>
            {manualShareText && (
              <div className="mt-3 space-y-2 text-left">
                <textarea
                  readOnly
                  value={manualShareText}
                  className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  rows={8}
                  aria-label="Shareable results text"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(manualShareText);
                    setShareFeedback("Copied to clipboard!");
                  }}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Copy aria-hidden="true" className="size-3.5" />
                  <span>Copy Text</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share results (spoiler-free)"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {shareStatus === "copied" ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Share2 aria-hidden="true" className="size-4" />
            )}
            <span>
              {shareStatus === "copied"
                ? "Copied to Clipboard!"
                : shareStatus === "sharing"
                  ? "Sharing..."
                  : "Share Results"}
            </span>
          </button>

          <Link
            href={`/play?mode=${results.mode}&difficulty=${results.level}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-input bg-secondary px-5 py-3 font-semibold text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            <span>Play Again</span>
          </Link>

          <Link
            href="/play"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-secondary px-5 py-3 font-semibold text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Change Mode & Level
          </Link>

          <Link
            href="/stats"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-input bg-card px-5 py-3 font-semibold text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <BarChart3 aria-hidden="true" className="size-4 text-primary" />
            <span>View Stats</span>
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-card px-5 py-3 font-semibold text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Home
          </Link>
        </div>
      </section>

      {/* 10 Rounds Breakdown */}
      <section aria-labelledby="round-breakdown-heading" className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <h2
            id="round-breakdown-heading"
            className="text-xl font-bold tracking-tight text-foreground"
          >
            Round Breakdown ({results.rounds.length} Movies)
          </h2>
          <span className="text-xs text-muted-foreground">Ordered chronologically</span>
        </div>

        <div className="space-y-4">
          {results.rounds.map(item => {
            const { ordinal, mode, reveal } = item;
            const itemModeObj = modes.find(m => m.id === mode);
            const itemModeLabel = itemModeObj?.label ?? mode;
            const isCorrect = reveal.outcome === "correct";
            const isExhausted = reveal.outcome === "exhausted";

            return (
              <article
                key={ordinal}
                className="overflow-hidden rounded-xl border border-input bg-card shadow-xs transition-colors"
              >
                {/* Round Header / Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-secondary/30 px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                      {ordinal}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      Round {ordinal} · {itemModeLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/15 px-3 py-1 text-xs font-semibold text-success">
                        <CheckCircle2 aria-hidden="true" className="size-3.5" />
                        <span>+{reveal.score} pts</span>
                      </span>
                    ) : isExhausted ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">
                        <XCircle aria-hidden="true" className="size-3.5" />
                        <span>Exhausted (0 pts)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                        <HelpCircle aria-hidden="true" className="size-3.5" />
                        <span>Skipped (0 pts)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Movie Details Body */}
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-6 sm:p-6">
                  {/* Poster or Fallback Placeholder */}
                  <div className="relative mx-auto aspect-2/3 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40 shadow-xs sm:mx-0 sm:w-32">
                    {reveal.poster_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://image.tmdb.org/t/p/w500${reveal.poster_path}`}
                        alt={`Poster for ${reveal.title}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-muted-foreground">
                        <Film aria-hidden="true" className="mb-1 size-6 opacity-60" />
                        <span className="text-[11px] leading-tight">No poster available</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata Content with Safe Fallbacks */}
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-foreground">
                        {reveal.title || "Unknown Title"}
                      </h3>
                      {reveal.original_title &&
                        reveal.original_title !== reveal.title &&
                        reveal.original_title !== "Unknown Title" && (
                          <p className="text-xs italic text-muted-foreground">
                            Original: {reveal.original_title}
                          </p>
                        )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {reveal.release_year > 0 ? reveal.release_year : "Year unknown"} ·{" "}
                        {reveal.genres.length > 0
                          ? reveal.genres.join(", ")
                          : "Genres not listed"}
                      </p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="text-foreground">
                        <span className="font-semibold text-muted-foreground">Directed by: </span>
                        {reveal.directors.length > 0
                          ? reveal.directors.join(", ")
                          : "Director unavailable"}
                      </p>
                      <p className="text-foreground">
                        <span className="font-semibold text-muted-foreground">Starring: </span>
                        {reveal.cast.length > 0 ? reveal.cast.join(", ") : "Cast unavailable"}
                      </p>
                    </div>

                    <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {reveal.synopsis || "No synopsis available for this title."}
                    </p>

                    <div className="pt-1">
                      <a
                        href={`https://www.themoviedb.org/movie/${reveal.tmdb_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                      >
                        <span>View on TMDB</span>
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Round Metrics Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-secondary/15 px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
                  <span>Wrong guesses: {reveal.wrong_attempts}/3</span>
                  <span>Hints used: {reveal.hints_used}/3</span>
                  <span className="font-semibold text-foreground">
                    Round points: {reveal.score} pts
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Footer Return Links */}
      <nav aria-label="Results navigation" className="flex justify-center gap-4 border-t border-border/50 pt-6">
        <Link
          href={`/play?mode=${results.mode}&difficulty=${results.level}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          <span>Play Again</span>
        </Link>
        <Link
          href="/play"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-secondary px-5 py-3 font-semibold text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          New Game
        </Link>
      </nav>
    </main>
  );
}

export function ResultsIncompleteView({ sessionId }: { sessionId: string }) {
  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-16 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
        <Clock aria-hidden="true" className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Game In Progress
        </h1>
        <p className="text-sm text-muted-foreground">
          This game session has not been completed yet. Finish all 10 rounds to unlock your
          final score and complete breakdown.
        </p>
      </div>
      <div className="pt-2">
        <Link
          href={`/play/${sessionId}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span>Resume Game</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </main>
  );
}

export function ResultsErrorView({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-16 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
        <AlertTriangle aria-hidden="true" className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="pt-2">
        <Link
          href="/play"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Start New Game
        </Link>
      </div>
    </main>
  );
}

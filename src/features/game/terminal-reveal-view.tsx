import { ArrowRight, CheckCircle2, ExternalLink, HelpCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TerminalReveal } from "@/lib/server/game/dto";

export function TerminalRevealView({
  reveal,
  currentRound,
  totalRounds = 10,
  onNext,
  isAdvancing,
}: {
  reveal: TerminalReveal;
  currentRound: number;
  totalRounds?: number;
  onNext: () => void;
  isAdvancing: boolean;
}) {
  const isCorrect = reveal.outcome === "correct";
  const isExhausted = reveal.outcome === "exhausted";

  return (
    <div className="space-y-6 rounded-xl border border-input bg-card p-5 sm:p-7">
      {/* Outcome Banner */}
      <div
        className={`flex items-center gap-3 rounded-lg border p-4 ${
          isCorrect
            ? "border-success/40 bg-success/10 text-success"
            : isExhausted
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-border bg-secondary/50 text-muted-foreground"
        }`}
      >
        {isCorrect ? (
          <CheckCircle2 aria-hidden="true" className="size-6 shrink-0" />
        ) : isExhausted ? (
          <XCircle aria-hidden="true" className="size-6 shrink-0" />
        ) : (
          <HelpCircle aria-hidden="true" className="size-6 shrink-0" />
        )}
        <div>
          <h2 className="text-lg font-bold">
            {isCorrect
              ? "Correct answer!"
              : isExhausted
              ? "Attempts exhausted"
              : "Round skipped"}
          </h2>
          <p className="text-sm">
            {isCorrect
              ? `You earned +${reveal.score} points.`
              : "0 points awarded for this round."}
          </p>
        </div>
      </div>

      {/* Movie Details Grid */}
      <div className="flex flex-col gap-6 sm:flex-row">
        {reveal.poster_path && (
          <div className="relative mx-auto aspect-2/3 w-36 shrink-0 overflow-hidden rounded-lg bg-secondary shadow-md sm:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://image.tmdb.org/t/p/w500${reveal.poster_path}`}
              alt={`Movie poster for ${reveal.title}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {reveal.title}
            </h3>
            {reveal.original_title && reveal.original_title !== reveal.title && (
              <p className="text-sm text-muted-foreground italic">
                Original title: {reveal.original_title}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {reveal.release_year} · {reveal.genres.join(", ")}
            </p>
          </div>

          {reveal.directors.length > 0 && (
            <p className="text-sm text-foreground">
              <span className="font-semibold text-muted-foreground">Directed by: </span>
              {reveal.directors.join(", ")}
            </p>
          )}

          {reveal.cast.length > 0 && (
            <p className="text-sm text-foreground">
              <span className="font-semibold text-muted-foreground">Cast: </span>
              {reveal.cast.join(", ")}
            </p>
          )}

          {reveal.synopsis && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {reveal.synopsis}
            </p>
          )}

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

      {/* Round Breakdown */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4 text-xs text-muted-foreground">
        <span>Wrong guesses: {reveal.wrong_attempts}/3</span>
        <span>Hints used: {reveal.hints_used}/3</span>
        <span className="font-semibold text-foreground">Round score: {reveal.score} pts</span>
      </div>

      {/* Advance Action */}
      <div className="border-t border-border/50 pt-4">
        <Button
          onClick={onNext}
          disabled={isAdvancing}
          className="w-full sm:w-auto min-w-44"
        >
          <span>
            {isAdvancing
              ? "Loading next round…"
              : currentRound === totalRounds
              ? "Finish Game & View Results"
              : `Next Round (${currentRound + 1}/${totalRounds})`}
          </span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

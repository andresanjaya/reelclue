"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Film,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { saveActiveSession } from "@/lib/client/storage";

interface DailyStatus {
  challengeDate: string;
  resetAt: string;
  secondsUntilReset: number;
  hasOfficialAttempt: boolean;
  officialSession: {
    id: string;
    state: "active" | "completed" | "expired";
    score: number;
    currentRound: number;
  } | null;
  canStartOfficial: boolean;
  canResume: boolean;
  practiceAttemptsCount: number;
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00h 00m 00s";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function formatDisplayDate(dateStr: string): string {
  try {
    const parts = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function DailyView() {
  const router = useRouter();
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const submittingRef = useRef(false);

  // 1. Fetch daily challenge status and initialize player
  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        // Ensure player identity cookie exists
        await fetch("/api/player", { method: "POST" }).catch(() => null);

        const res = await fetch("/api/daily");
        if (!res.ok) throw new Error("Failed to load daily challenge status");

        const data = await res.json();
        if (mounted) {
          setStatus(data);
          setSecondsRemaining(data.secondsUntilReset ?? 0);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setError("Unable to load today's daily challenge. Please try again shortly.");
          setLoading(false);
        }
      }
    }

    loadStatus();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Countdown timer ticking every second
  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  const handleStart = async (isPractice = false) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      // Ensure player cookie
      await fetch("/api/player", { method: "POST" }).catch(() => null);

      const actionId = crypto.randomUUID();
      const res = await fetch("/api/daily/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, isPractice }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const errMsg = body?.error?.message;
        if (res.status === 409) {
          setError("Official attempt already completed for today. Starting practice mode...");
          // Fall back to practice mode
          return handleStart(true);
        }
        setError(errMsg || "Failed to start daily challenge. Please try again.");
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      saveActiveSession({
        id: data.sessionId,
        mode: "mixed",
        level: "medium",
      });

      router.push(`/play/${data.sessionId}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Top Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-280 items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Film aria-hidden="true" className="size-6" />
            <span>ReelClue</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/play"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <span>Custom Game</span>
            </Link>
            <Link
              href="/stats"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <span>Stats</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-280 space-y-8 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {/* Banner Section */}
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles aria-hidden="true" className="size-3.5" />
            <span>Daily Puzzle</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Daily Challenge
          </h1>

          <p className="text-lg text-muted-foreground">
            One shared 10-round movie puzzle every single day. The exact same films and clues for players all around the world.
          </p>
        </div>

        {/* Status Region */}
        {error && (
          <div
            role="status"
            aria-live="polite"
            className="max-w-2xl rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
          >
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <div className="max-w-2xl space-y-4 rounded-xl border border-border/50 bg-card p-6">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted" />
            <div className="h-11 w-40 animate-pulse rounded bg-muted" />
          </div>
        ) : status ? (
          <div className="max-w-2xl space-y-6">
            {/* Date & Reset Card */}
            <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Calendar aria-hidden="true" className="size-5 text-primary" />
                  <span>{formatDisplayDate(status.challengeDate)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                  <Clock aria-hidden="true" className="size-3.5" />
                  <span>Resets in: <strong className="text-primary">{formatCountdown(secondsRemaining)}</strong> (00:00 UTC)</span>
                </div>
              </div>

              {/* Challenge Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Session Mode</span>
                  <p className="font-semibold text-foreground">Mixed Clues</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Familiarity Tier</span>
                  <p className="font-semibold text-foreground">Medium</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Length</span>
                  <p className="font-semibold text-foreground">10 Rounds</p>
                </div>
              </div>
            </div>

            {/* Action State Card */}
            <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm space-y-5">
              {status.officialSession?.state === "completed" ? (
                /* Completed State */
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-success">
                    <Trophy aria-hidden="true" className="size-6 text-primary" />
                    <div>
                      <h2 className="text-lg font-bold text-foreground">
                        Today&apos;s Challenge Completed!
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Your official score: <strong className="text-primary">{status.officialSession.score} pts</strong>
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You have finished your official attempt for today. You can review your round results or replay the challenge in practice mode.
                  </p>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Link
                      href={`/results/${status.officialSession.id}`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                      <span>View Results</span>
                    </Link>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleStart(true)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-5 py-2.5 font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-50"
                    >
                      <RotateCcw aria-hidden="true" className="size-4" />
                      <span>{submitting ? "Starting..." : "Play Practice Round"}</span>
                    </button>
                  </div>
                </div>
              ) : status.canResume && status.officialSession ? (
                /* In Progress State */
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Play aria-hidden="true" className="size-6 text-primary fill-current" />
                    <div>
                      <h2 className="text-lg font-bold text-foreground">
                        Challenge In Progress
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Round {status.officialSession.currentRound} of 10 • Score: {status.officialSession.score} pts
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You have an unfinished official attempt for today. Resume where you left off.
                  </p>

                  <div className="pt-2">
                    <Link
                      href={`/play/${status.officialSession.id}`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                      <Play aria-hidden="true" className="size-4 fill-current" />
                      <span>Resume Challenge</span>
                    </Link>
                  </div>
                </div>
              ) : (
                /* Not Started State */
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      Ready to test your movie knowledge?
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      You have <strong>1 official attempt</strong> for today&apos;s puzzle. Subsequent attempts will be recorded as practice.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleStart(false)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-50"
                    >
                      <Play aria-hidden="true" className="size-5 fill-current" />
                      <span>{submitting ? "Preparing Challenge..." : "Start Official Challenge"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* How It Works Card */}
            <div className="rounded-xl border border-border/40 bg-card/60 p-5 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <HelpCircle aria-hidden="true" className="size-4 text-primary" />
                <span>Daily Challenge Rules</span>
              </div>
              <ul className="list-disc list-inside space-y-1.5 leading-relaxed">
                <li>10 rounds spanning all clue types (Poster Blur, Missing Title, Synopsis, Cast, Genre Detective).</li>
                <li>Identical movie selection and order for all players on the same UTC date.</li>
                <li>First completion counts as your official daily score; reload and timezone shifts preserve your session.</li>
                <li>Resets every day at 00:00 UTC. No timers, no accounts, no public leaderboards.</li>
              </ul>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}


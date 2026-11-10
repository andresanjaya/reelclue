"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Clock, Film, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  dismissActiveSession,
  getActiveResumableSession,
  loadLocalData,
  saveActiveSession,
  savePreferences,
  type LastSessionRecord,
} from "@/lib/client/storage";
import {
  Feedback,
  LevelSelector,
  ModeCard,
  modes,
  type Level,
  type Mode,
} from "./components";

export function PlaySetup() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modeParam = searchParams?.get("mode") as Mode | null;
  const levelParam = (searchParams?.get("difficulty") ?? searchParams?.get("level"))?.toLowerCase();

  const [mode, setMode] = useState<Mode>(() => {
    if (modes.some(m => m.id === modeParam)) return modeParam!;
    if (typeof window !== "undefined") {
      const pref = loadLocalData().preferences.mode;
      if (pref && modes.some(m => m.id === pref)) return pref as Mode;
    }
    return "poster";
  });

  const [level, setLevel] = useState<Level>(() => {
    if (levelParam === "medium") return "Medium";
    if (levelParam === "hard") return "Hard";
    if (levelParam === "easy") return "Easy";
    if (typeof window !== "undefined") {
      const pref = loadLocalData().preferences.level?.toLowerCase();
      if (pref === "medium") return "Medium";
      if (pref === "hard") return "Hard";
      if (pref === "easy") return "Easy";
    }
    return "Easy";
  });

  const [resumableSession, setResumableSession] = useState<LastSessionRecord | null>(() => {
    if (typeof window !== "undefined") {
      return getActiveResumableSession();
    }
    return null;
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submittingRef = useRef(false);

  const playerInitPromiseRef = useRef<Promise<boolean> | null>(null);

  // Initialize anonymous player identity cookie on mount
  useEffect(() => {
    if (!playerInitPromiseRef.current) {
      playerInitPromiseRef.current = fetch("/api/player", { method: "POST" })
        .then(res => res.ok)
        .catch(() => false);
    }
  }, []);

  const handleStartGame = async () => {
    // Double-tap / concurrent submission guard
    if (submittingRef.current) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("You appear to be offline. Please connect to the internet to start a game.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    const actionId = crypto.randomUUID();

    try {
      // 1. Ensure player identity established without racing
      const initialized = await playerInitPromiseRef.current;
      if (!initialized && !(await fetch("/api/player", { method: "POST" })).ok) {
        throw new Error("Player identity unavailable");
      }

      // 2. Fetch recent movie IDs to prefer excluding
      const localData = loadLocalData();
      const recentMovieIds = localData.recent_movie_ids;

      // 3. Create game session
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          difficulty: level.toLowerCase(),
          actionId,
          recentMovieIds,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const errCode = body?.error?.code;
        const errMsg = body?.error?.message;

        if (res.status === 400 && errCode === "CATALOG_SHORTAGE") {
          setError(errMsg || "Not enough eligible movies in catalog for this mode and difficulty combination yet.");
        } else if (res.status === 503) {
          setError("Catalog is currently unavailable. Please try again shortly.");
        } else if (res.status === 429) {
          setError("Rate limit reached. Please wait a moment before starting a new game.");
        } else {
          setError(errMsg || "Failed to create game session. Please try again.");
        }
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }

      const session = await res.json();
      saveActiveSession({
        id: session.id,
        mode,
        level: level.toLowerCase(),
      });

      router.push(`/play/${session.id}`);
    } catch {
      setError("Network connection error. Please check your connection and try again.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const resumableModeLabel = resumableSession
    ? modes.find(m => m.id === resumableSession.mode)?.label ?? resumableSession.mode
    : "";
  const resumableLevelLabel = resumableSession
    ? resumableSession.level.charAt(0).toUpperCase() + resumableSession.level.slice(1)
    : "";

  return (
    <main className="mx-auto max-w-280 space-y-8 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="max-w-2xl space-y-3">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Film aria-hidden="true" className="size-5" /> ReelClue
          </Link>
          <Link
            href="/stats"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <BarChart3 aria-hidden="true" className="size-4" />
            <span>Stats</span>
          </Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Game setup</h1>
        <p className="text-muted-foreground">
          Choose a clue mode and difficulty level. Every game features 10 distinct movie rounds.
        </p>
      </header>

      {/* Resume Active Session Banner */}
      {resumableSession && (
        <section
          aria-labelledby="resume-heading"
          className="max-w-2xl flex flex-col gap-3 rounded-xl border border-primary/40 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Clock aria-hidden="true" className="size-3.5" />
              In-progress game found
            </span>
            <h2 id="resume-heading" className="text-sm font-medium text-foreground">
              You have an active session ({resumableModeLabel} · {resumableLevelLabel})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/play/${resumableSession.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Resume Game
            </Link>
            <button
              type="button"
              onClick={() => {
                dismissActiveSession();
                setResumableSession(null);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          handleStartGame();
        }}
        className="max-w-2xl space-y-6"
      >
        <fieldset className="min-w-0 space-y-3">
          <legend className="font-semibold text-foreground">Select clue mode</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {modes.map(item => (
              <ModeCard
                key={item.id}
                mode={item}
                name="game-mode"
                value={item.id}
                checked={mode === item.id}
                onChange={() => {
                  setMode(item.id);
                  savePreferences({ mode: item.id });
                  setError(null);
                }}
              />
            ))}
          </div>
        </fieldset>

        <LevelSelector
          name="game-level"
          value={level}
          onChange={l => {
            setLevel(l);
            savePreferences({ level: l.toLowerCase() });
            setError(null);
          }}
          disabled={submitting}
        />

        {error && <Feedback tone="error">{error}</Feedback>}

        <div className="pt-2">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto min-w-44"
          >
            <Play aria-hidden="true" className="size-4 fill-current" />
            {submitting ? "Starting game…" : "Start Game"}
          </Button>
        </div>
      </form>
    </main>
  );
}

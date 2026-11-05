"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Film, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  const initialMode = modes.some(m => m.id === modeParam) ? modeParam! : "poster";

  const levelParam = (searchParams?.get("difficulty") ?? searchParams?.get("level"))?.toLowerCase();
  const initialLevel: Level =
    levelParam === "medium" ? "Medium" : levelParam === "hard" ? "Hard" : "Easy";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [level, setLevel] = useState<Level>(initialLevel);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submittingRef = useRef(false);

  // Initialize anonymous player identity cookie on mount
  useEffect(() => {
    fetch("/api/player", { method: "POST" }).catch(() => {
      // Non-blocking: game start will establish if absent
    });
  }, []);

  const handleStartGame = async () => {
    // Double-tap / concurrent submission guard
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    const actionId = crypto.randomUUID();

    try {
      // 1. Ensure player identity established
      await fetch("/api/player", { method: "POST" });

      // 2. Create game session
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          difficulty: level.toLowerCase(),
          actionId,
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
      router.push(`/play/${session.id}`);
    } catch {
      setError("Network connection error. Please check your connection and try again.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-280 space-y-8 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="max-w-2xl space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <Film aria-hidden="true" className="size-5" /> ReelClue
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Game setup</h1>
        <p className="text-muted-foreground">
          Choose a clue mode and difficulty level. Every game features 10 distinct movie rounds.
        </p>
      </header>

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

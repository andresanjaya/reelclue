"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Film,
  Lightbulb,
  LogOut,
  RefreshCw,
  SkipForward,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClueRenderer } from "./clue-renderer";
import { ClueSkeleton, Feedback, GameHeader, modes, type Level } from "./components";
import {
  gameplayReducer,
  initialGameplayState,
} from "./gameplay-reducer";
import { getHintDetails } from "./hint-helpers";
import { SearchableAnswerCombobox } from "./answer-combobox";
import { TerminalRevealView } from "./terminal-reveal-view";
import type { AmbiguousChoice } from "@/lib/server/game/dto";
import { markActiveSessionCompleted, saveActiveSession } from "@/lib/client/storage";

export function GameplayShell({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(gameplayReducer, initialGameplayState);
  const inFlightRef = useRef(false);

  // 1. Initial fetch & refresh/resume
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const loadSession = useCallback(async () => {
    dispatch({ type: "LOAD_START" });
    try {
      const res = await fetch(`/api/games/${sessionId}`, {
        headers: { Accept: "application/json" },
      });

      if (res.status === 401) {
        // Player identity cookie might not be present; attempt to establish identity
        const playerRes = await fetch("/api/player", { method: "POST" });
        if (playerRes.ok) {
          const retryRes = await fetch(`/api/games/${sessionId}`, {
            headers: { Accept: "application/json" },
          });
          if (retryRes.ok) {
            const data = await retryRes.json();
            if (data.state === "completed") {
              markActiveSessionCompleted(sessionId);
              routerRef.current.push(`/results/${sessionId}`);
              return;
            }
            saveActiveSession({ id: data.id, mode: data.mode, level: data.level });
            dispatch({ type: "LOAD_SUCCESS", session: data });
            return;
          }
        }
        dispatch({
          type: "LOAD_ERROR",
          error: {
            code: "UNAUTHORIZED",
            message: "Player identity missing or invalid for this game.",
            retryable: true,
          },
        });
        return;
      }

      if (res.status === 410) {
        markActiveSessionCompleted(sessionId);
        dispatch({
          type: "LOAD_ERROR",
          error: {
            code: "SESSION_EXPIRED",
            message: "This game session has expired (valid for 24 hours).",
            retryable: false,
          },
        });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        dispatch({
          type: "LOAD_ERROR",
          error: {
            code: body?.error?.code ?? "NOT_FOUND",
            message: body?.error?.message ?? "Game session not found.",
            retryable: res.status >= 500,
          },
        });
        return;
      }

      const data = await res.json();
      if (data.state === "completed") {
        markActiveSessionCompleted(sessionId);
        routerRef.current.push(`/results/${sessionId}`);
        return;
      }
      saveActiveSession({ id: data.id, mode: data.mode, level: data.level });
      dispatch({ type: "LOAD_SUCCESS", session: data });
    } catch {
      dispatch({
        type: "LOAD_ERROR",
        error: {
          code: "NETWORK_ERROR",
          message: "Unable to load game. Please check your connection and retry.",
          retryable: true,
        },
      });
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Re-sync session helper for 409 revision mismatches
  const resyncSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${sessionId}`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state === "completed") {
          markActiveSessionCompleted(sessionId);
          routerRef.current.push(`/results/${sessionId}`);
          return;
        }
        dispatch({ type: "STALE_RELOAD", session: data });
      }
    } catch {
      // Ignore background re-sync failures
    }
  }, [sessionId]);

  // 2. Submit Guess
  const submitGuess = async (choiceHandleOverride?: string) => {
    if (!state.session || inFlightRef.current || state.status !== "idle") return;

    const round = state.session.active_round;
    if (round.state !== "guessing") return;

    const choiceHandle = choiceHandleOverride ?? (state.selectedChoice ? state.selectedChoice.handle : undefined);
    const answerText = choiceHandle ? undefined : state.typedGuess.trim();

    if (!choiceHandle && !answerText) return;

    inFlightRef.current = true;
    const actionId = state.lastActionId ?? crypto.randomUUID();

    dispatch({
      type: "GUESS_START",
      actionId,
      payload: { answerText, choiceHandle },
    });

    try {
      const res = await fetch(`/api/games/${sessionId}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: round.id,
          actionId,
          revision: state.session.revision,
          ...(choiceHandle ? { choiceHandle } : { answerText }),
        }),
      });

      if (res.status === 409) {
        await resyncSession();
        inFlightRef.current = false;
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        dispatch({
          type: "GUESS_ERROR",
          error: {
            code: body?.error?.code ?? "GUESS_FAILED",
            message: body?.error?.message ?? "Failed to submit guess.",
            retryable: true,
          },
        });
        inFlightRef.current = false;
        return;
      }

      const result = await res.json();
      dispatch({ type: "GUESS_SUCCESS", result });
    } catch {
      dispatch({
        type: "GUESS_ERROR",
        error: {
          code: "NETWORK_ERROR",
          message: "Network error submitting guess. You can retry safely.",
          retryable: true,
        },
      });
    } finally {
      inFlightRef.current = false;
    }
  };

  // 3. Request Hint
  const requestHint = async () => {
    if (!state.session || inFlightRef.current || state.status !== "idle") return;

    const round = state.session.active_round;
    if (round.state !== "guessing" || round.hint_stage >= 3) return;

    inFlightRef.current = true;
    const actionId = state.lastActionId ?? crypto.randomUUID();

    dispatch({ type: "HINT_START", actionId });

    try {
      const res = await fetch(`/api/games/${sessionId}/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: round.id,
          actionId,
          revision: state.session.revision,
        }),
      });

      if (res.status === 409) {
        await resyncSession();
        inFlightRef.current = false;
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        dispatch({
          type: "HINT_ERROR",
          error: {
            code: body?.error?.code ?? "HINT_FAILED",
            message: body?.error?.message ?? "Failed to reveal hint.",
            retryable: true,
          },
        });
        inFlightRef.current = false;
        return;
      }

      const updatedSession = await res.json();
      dispatch({ type: "HINT_SUCCESS", session: updatedSession });
    } catch {
      dispatch({
        type: "HINT_ERROR",
        error: {
          code: "NETWORK_ERROR",
          message: "Network error requesting hint. You can retry safely.",
          retryable: true,
        },
      });
    } finally {
      inFlightRef.current = false;
    }
  };

  // 4. Skip Round
  const skipRound = async () => {
    if (!state.session || inFlightRef.current || state.status !== "idle") return;

    const round = state.session.active_round;
    if (round.state !== "guessing") return;

    inFlightRef.current = true;
    const actionId = state.lastActionId ?? crypto.randomUUID();

    dispatch({ type: "SKIP_START", actionId });

    try {
      const res = await fetch(`/api/games/${sessionId}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: round.id,
          actionId,
          revision: state.session.revision,
        }),
      });

      if (res.status === 409) {
        await resyncSession();
        inFlightRef.current = false;
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        dispatch({
          type: "SKIP_ERROR",
          error: {
            code: body?.error?.code ?? "SKIP_FAILED",
            message: body?.error?.message ?? "Failed to skip round.",
            retryable: true,
          },
        });
        inFlightRef.current = false;
        return;
      }

      const updatedSession = await res.json();
      dispatch({ type: "SKIP_SUCCESS", session: updatedSession });
    } catch {
      dispatch({
        type: "SKIP_ERROR",
        error: {
          code: "NETWORK_ERROR",
          message: "Network error skipping round. You can retry safely.",
          retryable: true,
        },
      });
    } finally {
      inFlightRef.current = false;
    }
  };

  // 5. Advance to Next Round
  const advanceNextRound = async () => {
    if (!state.session || inFlightRef.current || state.status !== "idle") return;

    const round = state.session.active_round;
    if (round.state === "guessing") return;

    inFlightRef.current = true;
    const actionId = state.lastActionId ?? crypto.randomUUID();

    dispatch({ type: "NEXT_START", actionId });

    try {
      const res = await fetch(`/api/games/${sessionId}/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: round.id,
          actionId,
          revision: state.session.revision,
        }),
      });

      if (res.status === 409) {
        await resyncSession();
        inFlightRef.current = false;
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        dispatch({
          type: "NEXT_ERROR",
          error: {
            code: body?.error?.code ?? "NEXT_FAILED",
            message: body?.error?.message ?? "Failed to advance to next round.",
            retryable: true,
          },
        });
        inFlightRef.current = false;
        return;
      }

      const updatedSession = await res.json();
      if (updatedSession.state === "completed") {
        markActiveSessionCompleted(sessionId);
        router.push(`/results/${sessionId}`);
        return;
      }
      dispatch({ type: "NEXT_SUCCESS", session: updatedSession });
    } catch {
      dispatch({
        type: "NEXT_ERROR",
        error: {
          code: "NETWORK_ERROR",
          message: "Network error advancing round. You can retry safely.",
          retryable: true,
        },
      });
    } finally {
      inFlightRef.current = false;
    }
  };

  // 6. Action retry handler reusing lastActionId
  const handleRetryAction = () => {
    if (!state.error || !state.error.action) return;
    const action = state.error.action;
    dispatch({ type: "CLEAR_ERROR" });

    if (action === "load") {
      loadSession();
    } else if (action === "guess") {
      const payload = state.lastActionPayload;
      submitGuess(payload?.choiceHandle);
    } else if (action === "hint") {
      requestHint();
    } else if (action === "skip") {
      skipRound();
    } else if (action === "next") {
      advanceNextRound();
    }
  };

  const isMutating =
    state.status === "submitting" ||
    state.status === "hinting" ||
    state.status === "skipping" ||
    state.status === "advancing";

  // Loading view
  if (state.status === "loading") {
    return (
      <main className="mx-auto max-w-280 space-y-6 px-4 py-8">
        <header className="flex items-center justify-between border-b border-border/50 pb-4">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-primary">
            <Film aria-hidden="true" className="size-5" />
            <span>ReelClue</span>
          </Link>
          <span className="text-xs text-muted-foreground font-mono">Loading session…</span>
        </header>
        <ClueSkeleton />
      </main>
    );
  }

  // Session Expired view
  if (state.status === "expired") {
    return (
      <main className="mx-auto max-w-xl space-y-6 px-4 py-16 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Clock aria-hidden="true" className="size-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Session Expired
        </h1>
        <p className="text-muted-foreground">
          Game sessions are valid for 24 hours. This game has expired, but you can jump straight into a fresh one.
        </p>
        <div className="pt-4">
          <Link
            href="/play"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Start New Game
          </Link>
        </div>
      </main>
    );
  }

  // Game Completed view: redirect or link to dedicated results route
  if (state.status === "completed" || state.session?.state === "completed") {
    return (
      <main className="mx-auto max-w-md space-y-6 px-4 py-16 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Trophy aria-hidden="true" className="size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Game Complete!
          </h1>
          <p className="text-sm text-muted-foreground">
            Redirecting to your game breakdown and final score…
          </p>
        </div>
        <div className="pt-2">
          <Link
            href={`/results/${sessionId}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <span>View Results</span>
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </main>
    );
  }

  // Active game session
  const session = state.session;
  if (!session) {
    return (
      <main className="mx-auto max-w-xl space-y-6 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Game not found</h1>
        <p className="text-muted-foreground">This session could not be located.</p>
        <Link href="/play" className="text-primary hover:underline">Return to setup</Link>
      </main>
    );
  }

  const activeRound = session.active_round;
  const isTerminal = activeRound.state !== "guessing";
  const attemptsRemaining = Math.max(0, 3 - activeRound.wrong_attempts);
  const hintInfo = getHintDetails(activeRound.mode, activeRound.hint_stage);
  const modeObj = modes.find(m => m.id === session.mode);
  const currentRoundModeObj = modes.find(m => m.id === activeRound.mode);
  const currentRoundModeLabel = currentRoundModeObj?.label ?? activeRound.mode;
  const modeLabel =
    session.mode === "mixed"
      ? `Mixed · ${currentRoundModeLabel}`
      : (modeObj?.label ?? session.mode);
  const levelCapitalized = (session.level.charAt(0).toUpperCase() + session.level.slice(1)) as Level;

  return (
    <main className="mx-auto max-w-280 space-y-6 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Top Bar with Navigation & Quit Action */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <Film aria-hidden="true" className="size-5" />
          <span>ReelClue</span>
        </Link>
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_CONFIRMING_QUIT", value: true })}
          disabled={isMutating}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-50"
        >
          <LogOut aria-hidden="true" className="size-4" />
          <span>Exit Game</span>
        </button>
      </div>

      {/* Quit Confirmation Card */}
      {state.confirmingQuit && (
        <div
          role="dialog"
          aria-label="Exit Game Confirmation"
          className="rounded-lg border border-primary/50 bg-card p-5 space-y-3"
        >
          <h2 className="font-semibold text-lg text-foreground">Leave current game?</h2>
          <p className="text-sm text-muted-foreground">
            Your progress is preserved for 24 hours. You can resume anytime by returning to this link.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              variant="default"
              onClick={() => router.push("/")}
              className="text-sm"
            >
              Confirm Exit
            </Button>
            <Button
              variant="secondary"
              onClick={() => dispatch({ type: "SET_CONFIRMING_QUIT", value: false })}
              className="text-sm"
            >
              Continue Playing
            </Button>
          </div>
        </div>
      )}

      {/* Game Header */}
      <GameHeader
        round={activeRound.ordinal}
        total={10}
        mode={modeLabel}
        level={levelCapitalized}
        attempts={attemptsRemaining}
        score={session.score}
      />

      {/* Recoverable Error Banner */}
      {state.error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
            <span className="text-sm font-medium">{state.error.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {state.error.retryable && (
              <Button
                variant="secondary"
                onClick={handleRetryAction}
                className="min-h-9 px-3 py-1 text-xs"
              >
                <RefreshCw aria-hidden="true" className="size-3.5" />
                <span>Retry</span>
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => dispatch({ type: "CLEAR_ERROR" })}
              className="min-h-9 px-3 py-1 text-xs"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Active Question or Terminal Reveal */}
      {isTerminal ? (
        <TerminalRevealView
          reveal={activeRound.reveal!}
          currentRound={activeRound.ordinal}
          totalRounds={10}
          onNext={advanceNextRound}
          isAdvancing={state.status === "advancing"}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column: Clue Renderer */}
          <div className="min-w-0 space-y-4">
            <ClueRenderer clue={activeRound.clue} />
          </div>

          {/* Right Column: Answers & Controls */}
          <div className="min-w-0 space-y-5 rounded-xl border border-input bg-card p-4 sm:p-6">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Submit your guess
            </h2>

            {/* Ambiguity Prompt if present */}
            {state.ambiguityChoices && state.ambiguityChoices.length > 0 && (
              <div
                role="region"
                aria-label="Remake selection"
                className="space-y-3 rounded-lg border border-primary/40 bg-accent p-4"
              >
                <p className="text-sm font-semibold text-foreground">
                  Multiple movies share this title. Select the release year:
                </p>
                <div className="grid gap-2">
                  {state.ambiguityChoices.map((choice: AmbiguousChoice) => (
                    <Button
                      key={choice.choiceHandle}
                      variant="secondary"
                      onClick={() => submitGuess(choice.choiceHandle)}
                      disabled={isMutating}
                      className="justify-between text-left text-sm"
                    >
                      <span className="truncate">{choice.title}</span>
                      <span className="shrink-0 font-bold text-primary">
                        ({choice.releaseYear})
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Answer Combobox Form */}
            <form
              onSubmit={e => {
                e.preventDefault();
                submitGuess();
              }}
              className="space-y-4"
            >
              <SearchableAnswerCombobox
                value={state.typedGuess}
                onValueChange={text => dispatch({ type: "SET_TYPED_GUESS", value: text })}
                onSelect={choice => dispatch({ type: "SET_SELECTED_CHOICE", choice })}
                disabled={isMutating}
              />

              <Button
                type="submit"
                disabled={
                  isMutating ||
                  (!state.typedGuess.trim() && !state.selectedChoice)
                }
                className="w-full sm:w-auto min-w-36"
              >
                {state.status === "submitting" ? "Checking…" : "Submit Guess"}
              </Button>
            </form>

            {/* Polite Feedback Status */}
            {state.feedback && (
              <Feedback tone={state.feedback.tone}>
                {state.feedback.text}
              </Feedback>
            )}

            {/* Hints & Skip Actions */}
            <div className="space-y-3 border-t border-border/50 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  onClick={requestHint}
                  disabled={isMutating || activeRound.hint_stage >= 3}
                  className="text-xs"
                >
                  <Lightbulb aria-hidden="true" className="size-4 text-primary" />
                  <span>
                    {state.status === "hinting"
                      ? "Revealing hint…"
                      : hintInfo.label}
                  </span>
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => dispatch({ type: "SET_CONFIRMING_SKIP", value: true })}
                  disabled={isMutating}
                  className="text-xs"
                >
                  <SkipForward aria-hidden="true" className="size-4" />
                  <span>Skip Round</span>
                </Button>
              </div>

              {/* Skip Confirmation Banner */}
              {state.confirmingSkip && (
                <div
                  role="dialog"
                  aria-label="Skip round confirmation"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3 text-destructive"
                >
                  <p className="text-sm font-semibold">
                    Skip this round? You will receive 0 points and the movie will be revealed.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="default"
                      onClick={skipRound}
                      disabled={isMutating}
                      className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {state.status === "skipping" ? "Skipping…" : "Confirm Skip (0 pts)"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => dispatch({ type: "SET_CONFIRMING_SKIP", value: false })}
                      disabled={isMutating}
                      className="text-xs"
                    >
                      Keep Guessing
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

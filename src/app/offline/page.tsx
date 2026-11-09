"use client";

import Link from "next/link";
import { Film, RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  const handleRetry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary">
            <WifiOff className="h-7 w-7" aria-hidden="true" />
          </div>

          <div className="mb-2 flex items-center gap-2 text-primary">
            <Film className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-wider uppercase">ReelClue</span>
          </div>

          <h1 className="mb-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            You are offline
          </h1>

          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            ReelClue requires an active internet connection to securely verify clues, validate guesses, and track fairness on the server.
          </p>

          <div
            role="status"
            aria-live="polite"
            className="mb-6 w-full rounded-lg border border-border bg-muted/60 p-3 text-xs text-muted-foreground"
          >
            Your game sessions and scores are safely stored on the server and will resume when you reconnect.
          </div>

          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Retry Connection</span>
            </button>

            <Link
              href="/"
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-border bg-secondary px-4 py-2.5 font-medium text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

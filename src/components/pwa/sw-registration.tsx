"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Only register service worker in production or when explicitly enabled
    const isProd = process.env.NODE_ENV === "production";
    const isPwaEnabled = isProd || process.env.NEXT_PUBLIC_ENABLE_PWA === "true";

    if (!isPwaEnabled) {
      return;
    }

    const handleControllerChange = () => {
      // Reload on controller change to ensure fresh assets are active
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // If a worker is already waiting, prompt immediately
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdatePrompt(true);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setShowUpdatePrompt(true);
            }
          });
        });
      })
      .catch((error) => {
        // Suppress registration errors in environments where SW isn't permitted
        console.warn("ServiceWorker registration skipped or failed:", error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      setShowUpdatePrompt(false);
    }
  };

  if (!showUpdatePrompt) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-primary/50 bg-card p-4 shadow-2xl sm:bottom-6 sm:right-6 sm:left-auto"
      data-testid="pwa-update-prompt"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Update Available</h2>
            <p className="text-xs text-muted-foreground">
              A new version of ReelClue is ready. Refresh now to get the latest features.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowUpdatePrompt(false)}
            className="min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Later
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Update Now
          </button>
        </div>
      </div>
    </aside>
  );
}

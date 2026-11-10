"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== "undefined") {
      return navigator.onLine;
    }
    return true;
  });

  const [showRestoredNotice, setShowRestoredNotice] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestoredNotice(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showRestoredNotice) {
    return null;
  }

  if (!isOnline) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="w-full border-b border-destructive/40 bg-destructive/15 px-4 py-2.5 text-center text-sm font-medium text-destructive transition-all"
        data-testid="offline-banner"
      >
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>You are currently offline. Game actions require an internet connection to verify with the server.</span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="w-full border-b border-success/40 bg-success/15 px-4 py-2.5 text-center text-sm font-medium text-success transition-all"
      data-testid="online-restored-banner"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Connection restored. Resuming online play...</span>
      </div>
    </aside>
  );
}

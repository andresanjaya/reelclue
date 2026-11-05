import "server-only";
import { randomUUID } from "node:crypto";

export interface SafeLogEntry {
  requestId: string;
  routeClass: string;
  status: number;
  durationMs: number;
  providerStatus?: "ok" | "degraded" | "error" | "none";
  catalogVersion?: string;
  errorCode?: string;
  clientHash?: string;
}

export function generateRequestId(): string {
  return `rc_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/**
 * Log operational telemetry safely.
 * Never logs raw IPs, player tokens, free-text guesses, or unrevealed answers.
 */
export function logTelemetry(entry: SafeLogEntry): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });

  if (entry.status >= 500) {
    console.error(line);
  } else {
    console.info(line);
  }
}

import "server-only";
import { NextResponse } from "next/server";
import { GameError } from "../game/session";

export function createSafeHeaders(
  requestId?: string,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
    ...(requestId ? { "X-Request-ID": requestId } : {}),
    ...extra,
  };
}

export function isGameError(err: unknown): err is GameError {
  return (
    err instanceof GameError ||
    (typeof err === "object" &&
      err !== null &&
      "status" in err &&
      "code" in err &&
      typeof (err as { status: unknown }).status === "number" &&
      typeof (err as { code: unknown }).code === "string")
  );
}

/**
 * Normalizes any error into a safe, non-leaking JSON envelope.
 * Always applies Cache-Control: no-store, private and Retry-After when appropriate.
 */
export function toSafeErrorResponse(err: unknown, requestId?: string): NextResponse {
  const headers = createSafeHeaders(requestId);

  if (isGameError(err)) {
    if (err.retryAfter !== undefined) {
      headers["Retry-After"] = String(err.retryAfter);
    } else if (err.status === 503) {
      headers["Retry-After"] = "5";
    }

    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          retryable: err.retryable,
          ...(err.retryAfter !== undefined ? { retryAfter: err.retryAfter } : {}),
        },
      },
      { status: err.status, headers }
    );
  }

  // Never serialize database internals, stack traces, or raw error messages to client.
  headers["Retry-After"] = "5";
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        retryable: false,
      },
    },
    { status: 500, headers }
  );
}

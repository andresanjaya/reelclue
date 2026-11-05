import { NextResponse } from "next/server";
import {
  GameError,
  getOrCreatePlayer,
  PLAYER_COOKIE_NAME,
  validateOrigin,
} from "@/lib/server/game/session";
import { enforceRateLimits, RATE_LIMIT_POLICIES } from "@/lib/server/security/rate-limit";
import { createSafeHeaders, toSafeErrorResponse } from "@/lib/server/security/response";
import { generateRequestId, logTelemetry } from "@/lib/server/security/telemetry";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const start = Date.now();
  const requestId = generateRequestId();

  try {
    validateOrigin(request);
    await enforceRateLimits(request, RATE_LIMIT_POLICIES.player);

    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${PLAYER_COOKIE_NAME}=([^;]*)`));
    const existingToken = match ? match[1] : undefined;

    const player = await getOrCreatePlayer(existingToken);

    const response = NextResponse.json(
      { ok: true },
      {
        status: player.isNew ? 201 : 200,
        headers: createSafeHeaders(requestId),
      }
    );

    if (player.isNew) {
      response.cookies.set(PLAYER_COOKIE_NAME, player.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    logTelemetry({
      requestId,
      routeClass: "api.player",
      status: player.isNew ? 201 : 200,
      durationMs: Date.now() - start,
    });

    return response;
  } catch (err) {
    const errorStatus = err instanceof GameError ? err.status : 500;
    const errorCode = err instanceof GameError ? err.code : "INTERNAL_ERROR";

    logTelemetry({
      requestId,
      routeClass: "api.player",
      status: errorStatus,
      durationMs: Date.now() - start,
      errorCode,
    });

    return toSafeErrorResponse(err, requestId);
  }
}

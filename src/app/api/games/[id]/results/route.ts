import { NextResponse } from "next/server";
import {
  fetchGameResults,
  GameError,
  hashToken,
  PLAYER_COOKIE_NAME,
} from "@/lib/server/game/session";
import { enforceRateLimits, RATE_LIMIT_POLICIES } from "@/lib/server/security/rate-limit";
import { createSafeHeaders, toSafeErrorResponse } from "@/lib/server/security/response";
import { generateRequestId, logTelemetry } from "@/lib/server/security/telemetry";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const requestId = generateRequestId();

  try {
    const { id } = await props.params;

    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${PLAYER_COOKIE_NAME}=([^;]*)`));
    const playerToken = match ? match[1] : undefined;

    if (!playerToken) {
      throw new GameError(401, "UNAUTHORIZED", "Player identity cookie required", false);
    }

    await enforceRateLimits(request, RATE_LIMIT_POLICIES.sessionResults, playerToken);

    const results = await fetchGameResults(id, hashToken(playerToken));

    logTelemetry({
      requestId,
      routeClass: "api.games.results",
      status: 200,
      durationMs: Date.now() - start,
    });

    return NextResponse.json(results, {
      status: 200,
      headers: createSafeHeaders(requestId),
    });
  } catch (err) {
    const errorStatus = err instanceof GameError ? err.status : 500;
    const errorCode = err instanceof GameError ? err.code : "INTERNAL_ERROR";

    logTelemetry({
      requestId,
      routeClass: "api.games.results",
      status: errorStatus,
      durationMs: Date.now() - start,
      errorCode,
    });

    return toSafeErrorResponse(err, requestId);
  }
}

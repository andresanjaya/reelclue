import { NextResponse } from "next/server";
import { GameError, PLAYER_COOKIE_NAME } from "@/lib/server/game/session";
import { searchCatalogMovies } from "@/lib/server/catalog/search";
import { enforceRateLimits, RATE_LIMIT_POLICIES } from "@/lib/server/security/rate-limit";
import { createSafeHeaders, toSafeErrorResponse } from "@/lib/server/security/response";
import { generateRequestId, logTelemetry } from "@/lib/server/security/telemetry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const start = Date.now();
  const requestId = generateRequestId();

  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${PLAYER_COOKIE_NAME}=([^;]*)`));
    const playerToken = match ? match[1] : undefined;

    if (!playerToken) {
      throw new GameError(401, "UNAUTHORIZED", "Player identity cookie required", false);
    }

    await enforceRateLimits(request, RATE_LIMIT_POLICIES.search, playerToken);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (query === null || query.trim().length < 2) {
      throw new GameError(400, "VALIDATION_ERROR", "Search query must be at least 2 characters", false);
    }

    if (query.length > 100) {
      throw new GameError(400, "VALIDATION_ERROR", "Search query exceeds 100 characters", false);
    }

    const items = await searchCatalogMovies(query.trim(), 8);

    logTelemetry({
      requestId,
      routeClass: "api.movies.search",
      status: 200,
      durationMs: Date.now() - start,
    });

    return NextResponse.json(
      { items },
      {
        status: 200,
        headers: createSafeHeaders(requestId),
      }
    );
  } catch (err) {
    const errorStatus = err instanceof GameError ? err.status : 500;
    const errorCode = err instanceof GameError ? err.code : "INTERNAL_ERROR";

    logTelemetry({
      requestId,
      routeClass: "api.movies.search",
      status: errorStatus,
      durationMs: Date.now() - start,
      errorCode,
    });

    return toSafeErrorResponse(err, requestId);
  }
}
